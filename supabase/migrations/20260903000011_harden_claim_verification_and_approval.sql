-- Fixes GitHub issue #25 (business claim verification is not gated by the code at all) and
-- the approval half of #27 (four sequential writes with no transaction).
--
-- Both land in one migration because they are the same table and the same mechanism: the
-- privileged columns on business_claims come out of the client's grant, and every write to
-- them goes through a SECURITY DEFINER function instead.
--
-- WHAT WAS BROKEN. `authenticated` held table-level SELECT/UPDATE on every column of
-- business_claims, and RLS scoped that to the caller's own row. Table-level grants confer
-- the privilege on every column, so the claimant could do all three of these. Reproduced
-- live on 2026-09-03 with a real business-owner session:
--
--   1. GET  ?select=verification_code            -> read their own code in plaintext
--   2. PATCH {"verification_attempts": 0}        -> reset the counter, defeating lockout
--   3. PATCH {"status": "verified"}              -> mark themselves verified having never
--                                                   seen the code at all
--
-- (3) is the one that matters: guard_business_privileged_columns only rejected 'approved'
-- and 'rejected', so 'verified' was self-assignable and the code was decorative.
--
-- Also fixed here: the code was generated with Math.random(), not a CSPRNG, and the attempt
-- counter was a read-modify-write across two round trips, so the lockout could be raced.
--
-- HONEST LIMIT, recorded so nobody mistakes this for an ownership check. The code is emailed
-- to the CLAIMANT'S OWN account address (src/lib/actions/business-verification.ts sends to
-- user.email), which Supabase already verified at signup. It therefore proves control of an
-- address the user already controls -- it does not prove they own the business. Admin review
-- is the real gate: only an admin can set business_profiles.claim_status='approved', which is
-- what actually unlocks anything. Making this a genuine ownership check needs an out-of-band
-- channel to the business itself (a listed phone, a domain-matched address, a postcard) and
-- is a product decision, not a mechanical fix.

-- 1. take the privileged columns out of the client's grant --------------------
-- REVOKE at table level FIRST: a table-wide grant confers the privilege on every column, so
-- a column-level REVOKE against a table-wide grant is a no-op. This project has shipped that
-- mistake before (see 20260903000005_fix_profiles_update_grants.sql).
--
-- anon has no legitimate access to claims at all; RLS already denied it, but the grant should
-- not have been there either.
revoke select, insert, update, delete on public.business_claims from anon;
revoke select, insert, update, delete on public.business_claims from authenticated;

-- verification_code is deliberately ABSENT from the SELECT list. Nothing outside the definer
-- functions ever needs to read it, including admins.
grant select (
  id, profile_id, business_id, status, verification_method,
  verification_code_expires_at, verification_attempts, evidence_document_url,
  admin_notes, reviewed_at, reviewed_by, created_at, updated_at
) on public.business_claims to authenticated;

-- A claimant opens a claim; the code, its expiry, the attempt counter and the status are all
-- set by the functions below. evidence_document_url is the one field a claimant legitimately
-- updates afterwards (the document-upload path).
grant insert (profile_id, business_id, verification_method) on public.business_claims to authenticated;
grant update (evidence_document_url) on public.business_claims to authenticated;

-- 2. issuing a code ----------------------------------------------------------
-- Generates the code inside the database with pgcrypto's CSPRNG and stores only its SHA-256
-- digest, so a future read of the row -- by anyone, through any hole -- yields no usable code.
-- Returns the plaintext to its caller because the caller has to email it.
--
-- That return value is the residual exposure and it is deliberate: the caller runs with the
-- claimant's own session, so a claimant can obtain their own code. As noted above, the code
-- is emailed to that same person anyway, so this grants nothing new. What it does close is
-- everything else -- the code is unguessable, the counter is untouchable, and status can no
-- longer be set directly.
create or replace function public.issue_business_claim_code(p_claim_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_owner uuid;
  v_bytes bytea;
begin
  select profile_id into v_owner
    from public.business_claims
   where id = p_claim_id;

  if v_owner is null then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  -- A definer function is a public endpoint too: anyone with the anon key can POST to
  -- /rest/v1/rpc/. Re-check ownership inside rather than trusting the caller.
  if v_owner <> auth.uid() then
    raise exception 'not authorized for this claim' using errcode = '42501';
  end if;

  -- Six digits from a cryptographic source (pgcrypto), replacing Math.random(). Assembled
  -- byte by byte and shifted into a bigint so the value is provably non-negative -- a
  -- bit(32)::int cast is signed, and a negative modulo would produce a malformed code.
  -- Modulo bias across 2^32 into 10^6 is immaterial for a 10-minute single-use code.
  v_bytes := extensions.gen_random_bytes(4);
  v_code := lpad(
    ((
      (get_byte(v_bytes, 0)::bigint << 24) |
      (get_byte(v_bytes, 1)::bigint << 16) |
      (get_byte(v_bytes, 2)::bigint << 8)  |
       get_byte(v_bytes, 3)::bigint
    ) % 1000000)::text,
    6, '0'
  );

  update public.business_claims
     set verification_code = encode(extensions.digest(v_code, 'sha256'), 'hex'),
         verification_code_expires_at = now() + interval '10 minutes',
         verification_attempts = 0,
         status = 'code_sent',
         updated_at = now()
   where id = p_claim_id;

  return v_code;
end;
$$;

revoke execute on function public.issue_business_claim_code(uuid) from anon, public;
grant execute on function public.issue_business_claim_code(uuid) to authenticated;

-- 3. verifying a code --------------------------------------------------------
-- One statement does the expiry check, the lockout check, the comparison and the attempt
-- increment, so two concurrent requests cannot both see attempts = 2 and both proceed. The
-- previous implementation read the row, compared in JavaScript, then wrote attempts + 1 in a
-- second round trip -- the classic racing read-modify-write.
create or replace function public.verify_business_claim_code(p_claim_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_claim public.business_claims;
  v_max_attempts constant int := 3;
begin
  select * into v_claim from public.business_claims where id = p_claim_id;

  if v_claim.id is null then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if v_claim.profile_id <> auth.uid() then
    raise exception 'not authorized for this claim' using errcode = '42501';
  end if;

  if v_claim.status = 'verified' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if v_claim.verification_attempts >= v_max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'attempts_left', 0);
  end if;

  if v_claim.verification_code is null
     or v_claim.verification_code_expires_at is null
     or v_claim.verification_code_expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'attempts_left', 0);
  end if;

  -- Wrong code: increment and report what is left, in the same statement.
  if v_claim.verification_code
     is distinct from encode(extensions.digest(coalesce(p_code, ''), 'sha256'), 'hex') then
    update public.business_claims
       set verification_attempts = verification_attempts + 1,
           updated_at = now()
     where id = p_claim_id
     returning verification_attempts into v_claim.verification_attempts;

    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid',
      'attempts_left', greatest(0, v_max_attempts - v_claim.verification_attempts)
    );
  end if;

  -- Correct: clear the secret so it cannot be replayed, and hand off to admin review.
  -- 'pending' (not 'approved') -- verification never granted privilege and still does not.
  update public.business_claims
     set status = 'pending',
         verification_code = null,
         verification_code_expires_at = null,
         updated_at = now()
   where id = p_claim_id;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke execute on function public.verify_business_claim_code(uuid, text) from anon, public;
grant execute on function public.verify_business_claim_code(uuid, text) to authenticated;

-- 4. atomic claim approval / rejection (issue #27a) ---------------------------
-- approveClaimAction performed four sequential writes with no transaction and downgraded a
-- failed intermediate write to logger.warn, so a partial approval could leave
-- business_profiles saying 'approved' while business_claims still said 'pending' -- and the
-- profile write, the first one, is the one that grants privilege.
--
-- The notification and the email stay OUTSIDE this function, in the action. A failed
-- notification must not roll back an approval that has already been granted; the owner
-- being told late is a smaller problem than the grant silently reverting.
create or replace function public.approve_business_claim(
  p_claim_id uuid,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.business_claims;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Lock the row: two admins approving at once must serialise, not interleave.
  select * into v_claim from public.business_claims where id = p_claim_id for update;

  if v_claim.id is null then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  update public.business_claims
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         admin_notes = coalesce(p_admin_notes, admin_notes),
         updated_at = now()
   where id = p_claim_id;

  -- Same transaction as the claim row, which is the whole point: the two can no longer
  -- disagree. business_id is taken from the claim rather than trusted from the caller.
  update public.business_profiles
     set claim_status = 'approved',
         verification_status = 'verified',
         business_id = v_claim.business_id,
         updated_at = now()
   where id = v_claim.profile_id;

  return jsonb_build_object(
    'profile_id', v_claim.profile_id,
    'business_id', v_claim.business_id
  );
end;
$$;

revoke execute on function public.approve_business_claim(uuid, text) from anon, public;
grant execute on function public.approve_business_claim(uuid, text) to authenticated;

create or replace function public.reject_business_claim(
  p_claim_id uuid,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.business_claims;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_claim from public.business_claims where id = p_claim_id for update;

  if v_claim.id is null then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  update public.business_claims
     set status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         admin_notes = coalesce(p_admin_notes, admin_notes),
         updated_at = now()
   where id = p_claim_id;

  -- Rejection must NOT clear business_id: an owner may reapply, and the claim row is the
  -- record of what they applied for.
  update public.business_profiles
     set claim_status = 'rejected',
         updated_at = now()
   where id = v_claim.profile_id;

  return jsonb_build_object('profile_id', v_claim.profile_id);
end;
$$;

revoke execute on function public.reject_business_claim(uuid, text) from anon, public;
grant execute on function public.reject_business_claim(uuid, text) to authenticated;

notify pgrst, 'reload schema';
