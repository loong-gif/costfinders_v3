-- The public catalogue as two views, so the anon key can stop reading the tables behind them.
-- Step A of two. ADDITIVE ONLY: nothing is revoked or dropped here. Step B
-- (20260924050002_close_public_catalogue_reads.sql) closes the tables once the app reads these.
--
-- WHY
-- Owner decision: a clinic's identity stays hidden until a customer claims a deal. The site
-- already hides it (src/lib/utils/identity.ts, offerToAnonymousDeal), but the anon key ships in
-- every browser and today it can read master_business_info and join it to
-- promo_offer_master.business_id, and read clinic_services.source_url,
-- clinic_promotions.promotion_title / source_url, clinic_memberships.membership_name and the raw
-- offer_raw_text, all of which name the clinic. No service-role key exists or may be added, so
-- the database has to own what the public sees.
--
-- WHAT
--   1. The TS scrub (scrubProviderIdentity / identityTerms in src/lib/utils/identity.ts) ported
--      to SQL, rule for rule: the clinic's full name, each part of it, the part with trailing
--      generic/city words peeled off, its first word when distinctive, the website's name peeled
--      the same way, and any "Dr. <Name>". Whole tokens only, any case, accents folded. After a
--      preposition the name becomes "this provider", a possessive "the provider's", anywhere
--      else it is dropped. The generic-word list and the two service enums keep treatment and
--      everyday words (Glow, Skin, Botox...) from being stripped, and the city is never a term
--      ("Newport Beach Med Spa" keeps "Newport Beach" in its own offers).
--        identity_compact(text)                      compact()
--        provider_site_label(website)                siteLabel()
--        provider_generic_terms()                    GENERIC
--        provider_identity_terms(name, website, city) identityTerms()
--        scrub_identity_terms(text, terms, label)    the scrub over precomputed terms
--        scrub_provider_identity(text, name, website, city)   the one-call form
--      plus address_state_code(address), stateFromAddress() for business_state.
--   2. public.public_offers: one row per promo_offer_master row with is_active = true.
--      promo_offer_master's columns, with offer_raw_text and conditions scrubbed and the ids that
--      join to clinic tables (promotion_id, membership_plan_id, offer_fingerprint) withheld as
--      NULL. Flat business_city / business_state / campaign dates / plan fields for filtering,
--      and jsonb columns shaped exactly like the PostgREST embeds offers.ts used to request
--      (promo_offer_items, clinic_promotions, clinic_memberships, master_business_info), so
--      flattenOffer() reads either. source_url is always null; master_business_info carries
--      business_id and city only (name, website, address, score, review_count and category are
--      null: the category narrows a clinic within its city). A plan whose name contains the
--      clinic comes back NULL, not scrubbed: what is left of "NakedMD Members Club" is still
--      that clinic's brand (the TS offerTerms rule).
--   3. public.public_business_directory: the provider directory. name, address, city,
--      business_state, score, review_count, category, slug. NO business_id, phone, website,
--      socials or logo, so nothing joins it to an offer. slug is businessToProvider()'s
--      slugify, computed here so the routes and this view cannot diverge.
--   4. The five count RPCs become SECURITY DEFINER (owner postgres, search_path '', names
--      qualified) so they keep answering once anon loses the tables. get_city_deal_counts gains
--      `o.is_active`: as SECURITY INVOKER the anon policy applied it implicitly, and a definer
--      function bypasses RLS. The other four are unchanged in what they count.
--   5. Read policies for the authenticated readers that today lean on the public ones: admins
--      (private.is_admin(), as every existing admin policy does) and approved owners on
--      clinic_services / clinic_promotions / clinic_memberships / master_business_info, and
--      claimants on master_business_info (the business of any claim they made: the messages
--      page and readClinics() read it as the customer).
--
-- Both views run as their owner (postgres), so they read the tables past RLS; that is the
-- point. Grants are narrowed to SELECT: Supabase's default privileges grant ALL on a new
-- relation, and public_business_directory is a single-table view, which Postgres makes
-- auto-updatable. With the default grant, anon could UPDATE master_business_info through it.
--
-- The Supabase advisor will list both views under "Security Definer View" (ERROR). That is the
-- design, not an oversight: a security_invoker view would read the tables as anon, which step B
-- forbids. What they expose is exactly their column lists.
--
-- PIPELINE NOTE: these views depend on columns of the six tables. Dropping or retyping one of
-- them now fails with "other objects depend on it" instead of silently breaking the site. A
-- DROP ... CASCADE would drop the views and every public page with them.
--
-- SCRUB EXAMPLES (checked with a rolled-back SELECT before this file was handed over):
--   scrub('NakedMD Members Club — Chin Filler Radiesse 1.0cc $299', 'NakedMD Med Spa Tucson',
--         'https://www.nakedmd.com', 'Tucson')
--     -> 'Members Club — Chin Filler Radiesse 1.0cc $299'
--   scrub('Naked Lips | Lip Filler $149 (regular $299)', 'NakedMD Med Spa Tucson',
--         'https://www.nakedmd.com', 'Tucson')
--     -> 'Lips | Lip Filler $149 (regular $299)'
--   scrub('20% off one service never tried at West before', 'West Medical Aesthetics', null, null)
--     -> '20% off one service never tried at this provider before'
--   scrub('Belle Âme Bank Membership — 15% off all purchases.', 'Belle Âme Med Spa', null, null)
--     -> 'Bank Membership — 15% off all purchases.'
--   scrub('$13 per unit with Dr. Tsay', null, null, null)  -> '$13 per unit with the doctor'
--   scrub('Newport Beach Botox special', 'Newport Beach Med Spa', null, 'Newport Beach')
--     -> 'Newport Beach Botox special'   (the city is never a term)
--
-- VERIFY
--   select count(*) from public.public_offers;                 -- = active offers
--   select count(*) from public.promo_offer_master where is_active;
--   select count(*) from public.public_business_directory;     -- = master_business_info rows
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--    where table_name in ('public_offers', 'public_business_directory')
--      and grantee in ('anon', 'authenticated');                -- SELECT only
--   select proname, prosecdef, proconfig from pg_proc
--    where proname in ('get_business_cities', 'get_business_count_for_city',
--                      'get_business_category_counts', 'get_city_deal_counts',
--                      'get_offer_category_counts');            -- all t, {search_path=""}
--
-- ROLLBACK:
--   drop view if exists public.public_offers;
--   drop view if exists public.public_business_directory;
--   drop function if exists public.scrub_provider_identity(text, text, text, text);
--   drop function if exists public.scrub_identity_terms(text, text[], text);
--   drop function if exists public.provider_identity_terms(text, text, text);
--   drop function if exists public.provider_generic_terms();
--   drop function if exists public.provider_site_label(text);
--   drop function if exists public.address_state_code(text);
--   drop function if exists public.identity_compact(text);
--   drop policy "Admins can read all clinic services" on public.clinic_services;
--   drop policy "Owners can read their business services" on public.clinic_services;
--   drop policy "Admins can read all clinic promotions" on public.clinic_promotions;
--   drop policy "Owners can read their business promotions" on public.clinic_promotions;
--   drop policy "Admins can read all clinic memberships" on public.clinic_memberships;
--   drop policy "Owners can read their business memberships" on public.clinic_memberships;
--   drop policy "Admins can read all businesses" on public.master_business_info;
--   drop policy "Owners can read their business" on public.master_business_info;
--   drop policy "Claimants can read the clinics they claimed" on public.master_business_info;
--   and re-create the five RPCs as SECURITY INVOKER with `set search_path to 'public'` and
--   unqualified names (their prior bodies are these, minus `o.is_active` in
--   get_city_deal_counts).

-- ---------------------------------------------------------------------------------------------
-- 1. The scrub
-- ---------------------------------------------------------------------------------------------
-- None of these functions sets search_path. They are SECURITY INVOKER and read no table, so a
-- caller's search_path can do nothing through them that the caller cannot do directly, and a
-- SET clause costs a GUC save/restore per call and blocks SQL-function inlining: with it the
-- full catalogue read took 10.5 s (measured in a rolled-back transaction), because the view
-- calls these about 5,000 times per read.

-- identity.ts compact(): accents, case, "&" and "+" folded away. "Belle Âme" = "belleame".
create or replace function public.identity_compact(p_text text)
returns text
language sql
immutable
parallel safe
return regexp_replace(
  replace(
    replace(
      lower(regexp_replace(normalize(coalesce(p_text, ''), nfd), '[\u0300-\u036f]', '', 'g')),
      '&', 'and'
    ),
    '+', 'plus'
  ),
  '[^a-z0-9]', '', 'g'
);

-- stateFromAddress() in src/lib/data/adapters.ts: the two-letter code before the ZIP, and only
-- a real one (a two-letter run that is not a state is a street abbreviation).
create or replace function public.address_state_code(p_address text)
returns text
language sql
immutable
parallel safe
return (
  select s.code
    from (select substring(p_address from ',\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$') as code) s
   where s.code = any (array[
     'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY',
     'LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH',
     'OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'
   ])
);

-- siteLabel(): "https://www.nakedmd.com/pages/..." -> "nakedmd". A platform's host is not the
-- clinic's name.
create or replace function public.provider_site_label(p_website text)
returns text
language sql
immutable
parallel safe
return (
  select case
           when cardinality(h.labels) >= 2
            and not lower(h.labels[cardinality(h.labels) - 1]) = any (array[
              'facebook','instagram','linktr','glossgenius','wixsite','square','squareup',
              'vagaro','booksy','mindbodyonline','yelp','google'
            ])
           then h.labels[cardinality(h.labels) - 1]
         end
    from (
      select array_remove(string_to_array(regexp_replace(substring(
        regexp_replace(regexp_replace(p_website, '^\s+|\s+$', '', 'g'), '^[a-z]+://', '', 'i'),
        '^[^/?#]*'
      ), '^www\.', '', 'i'), '.'), '') as labels
    ) h
);

-- GENERIC in identity.ts: words too common to strip on their own, however a clinic is named, plus
-- every service and category name, so a clinic named after a treatment keeps the treatment in its
-- own offers.
-- ponytail: declared IMMUTABLE although it reads the two service enums, so the planner folds it
-- to a constant once per plan instead of once per call. A member the pipeline adds reaches it on
-- the next plan (a new connection); until then a clinic named after that treatment only loses the
-- word from its own offers, never leaks.
create or replace function public.provider_generic_terms()
returns text[]
language sql
immutable
parallel safe
return (
  select array_agg(public.identity_compact(w))
    from unnest(array[
      'beauty','beautiful','glow','skin','body','face','faces','facial','laser','med','medical',
      'spa','aesthetic','aesthetics','wellness','health','center','clinic','studio','bar',
      'lounge','house','new','pure','true','elite','luxe','luxury','vip','signature','premier',
      'prime','advanced','modern','total','perfect','radiant','radiance','fresh','youth','young',
      'ageless','forever','timeless','bliss','glam','lash','brow','smooth','sculpt','contour',
      'renew','revive','restore','vitality','hydration','tox','members','member','membership',
      'club','natural','bella','divine','serenity','harmony','balance','image','derm',
      'dermatology','plastic','surgery','iv','drip','medspa','medicalspa','botox','filler',
      'fillers','lips','therapy','removal','form','the','and'
    ]
    || enum_range(null::public.clinic_service_name_enum)::text[]
    || enum_range(null::public.clinic_service_category_enum)::text[]) as w
);

-- identityTerms(): every compacted spelling of this clinic worth stripping. The full name and each
-- part of it; each part with trailing generic and city words peeled off; its first word when that
-- is distinctive (4+ letters); the website's name, peeled the same way. Never a generic word,
-- never the city.
create or replace function public.provider_identity_terms(
  p_name text,
  p_website text,
  p_city text
)
returns text[]
language plpgsql
stable
parallel safe
as $fn$
declare
  -- WORD in identity.ts: letters, marks and digits, with a trailing "+" ("Faces+").
  c_word constant text := '[[:alnum:]\u0300-\u036f]+\+?';
  c_name_word constant text := '[[:alnum:]\u0300-\u036f]+\+?|&';
  c_suffix constant text[] := array[
    'med','medical','medspa','spa','md','aesthetics','aesthetic','esthetics','wellness',
    'center','centre','clinic','institute','studio','lounge','bar','face','skin','body','care',
    'skincare','beauty','solutions','anti','aging','cosmetic','cosmetics','dermatology','laser',
    'rejuvenation','group','llc','inc','pllc','co'
  ];
  c_connector constant text[] := array['and','of','the','by','at','for','dr'];
  c_domain_suffix constant text[] := array[
    'md','medicalspa','medspa','spa','aesthetics','aesthetic','medical','wellness','center',
    'clinic','solutions','skin','face','bar'
  ];
  v_generic constant text[] := public.provider_generic_terms();
  v_name text := btrim(coalesce(p_name, ''));
  v_label text := public.provider_site_label(p_website);
  v_city_words text[] := '{}';
  v_city text;
  v_min3 text[] := '{}';
  v_min4 text[] := '{}';
  v_terms text[] := '{}';
  v_parts text[];
  v_tokens text[];
  v_last text;
  v_site text;
  v_suffix text;
  v_term text;
  v_peeled boolean;
  v_i int;
  v_k int;
begin
  for v_k in 1 .. regexp_count(coalesce(p_city, ''), c_word) loop
    v_city_words := v_city_words || public.identity_compact(regexp_substr(p_city, c_word, 1, v_k));
  end loop;
  v_city := array_to_string(v_city_words, '');

  if v_name <> '' then
    v_min3 := v_min3 || public.identity_compact(v_name);
    v_parts := regexp_split_to_array(v_name, '\s*[:|,(]\s*|\s+[-–—]\s+');
    for v_i in 1 .. cardinality(v_parts) loop
      v_tokens := '{}';
      for v_k in 1 .. regexp_count(v_parts[v_i], c_name_word) loop
        v_tokens := v_tokens
          || public.identity_compact(regexp_substr(v_parts[v_i], c_name_word, 1, v_k));
      end loop;
      while cardinality(v_tokens) > 0 and v_tokens[1] in ('the', 'dr') loop
        v_tokens := v_tokens[2:];
      end loop;
      continue when cardinality(v_tokens) = 0;
      -- Past the first part a name is often a keyword list ("... | Med Spa, Botox, Laser"); keep
      -- a later part only when none of its words is generic ("Faces Plus: Dr. Steven Cohen").
      continue when v_i > 1 and v_tokens && v_generic;
      v_min3 := v_min3 || array_to_string(v_tokens, '');
      if v_i = 1 then
        v_min4 := v_min4 || v_tokens[1];
      end if;
      while cardinality(v_tokens) > 1 loop
        v_last := v_tokens[cardinality(v_tokens)];
        exit when not (v_last = any (c_suffix) or v_last = any (c_connector)
                       or v_last = any (v_city_words));
        v_tokens := v_tokens[1:cardinality(v_tokens) - 1];
        if not v_tokens[cardinality(v_tokens)] = any (c_connector) then
          v_min3 := v_min3 || array_to_string(v_tokens, '');
        end if;
      end loop;
    end loop;
  end if;

  if v_label is not null then
    v_site := public.identity_compact(v_label);
    v_min4 := v_min4 || v_site;
    loop
      v_peeled := false;
      foreach v_suffix in array c_domain_suffix loop
        if right(v_site, length(v_suffix)) = v_suffix
           and length(v_site) - length(v_suffix) >= 4 then
          v_site := left(v_site, length(v_site) - length(v_suffix));
          v_min4 := v_min4 || v_site;
          v_peeled := true;
          exit;
        end if;
      end loop;
      exit when not v_peeled;
    end loop;
  end if;

  foreach v_term in array v_min3 || v_min4 loop
    if length(v_term) >= (case when v_term = any (v_min3) then 3 else 4 end)
       and not v_term = any (v_generic)
       and v_term <> v_city
       and not v_term = any (v_city_words)
       and not v_term = any (v_terms) then
      v_terms := v_terms || v_term;
    end if;
  end loop;
  return v_terms;
end;
$fn$;

-- scrubProviderIdentity() over precomputed terms: the text with this clinic's name, its website
-- and any named doctor taken out. Whole words, any case. After a preposition the name becomes
-- "this provider", a possessive "the provider's", anywhere else it is dropped. public_offers
-- computes the terms and site label once per row and scrubs five or so texts with them.
-- ponytail: the word lists are copies of identity.ts, not shared. A word added on one side only
-- makes the two disagree on that word; the TS one is a no-op on public rows (they carry no name).
create or replace function public.scrub_identity_terms(
  p_text text,
  p_terms text[],
  p_label text
)
returns text
language plpgsql
stable
parallel safe
as $fn$
declare
  c_word constant text := '[[:alnum:]\u0300-\u036f]+\+?';
  v_out text;
  v_compact text;
  v_term text;
  v_hit boolean := false;
  v_starts int[] := '{}';
  v_ends int[] := '{}';
  v_span_s int[] := '{}';
  v_span_e int[] := '{}';
  v_pos int;
  v_s int;
  v_n int;
  v_i int;
  v_len int;
  v_k int;
  v_joined boolean;
  v_matched boolean;
  v_result text := '';
  v_cursor int := 1;
  v_before text;
  v_poss text;
  v_repl text;
begin
  if p_text is null then
    return null;
  end if;

  -- "Dr. K", "Dr Bonadkar", "Dr. Steven Cohen": a named doctor fingerprints a clinic too.
  v_out := regexp_replace(
    p_text,
    '\m(?:Dr|DR)\.?\s+[[:upper:]][[:alpha:]''’-]*(?:\s+[[:upper:]][[:alpha:]''’-]*(?=$|[\s.,;:!?)]))?',
    'the doctor',
    'g'
  );
  if p_label is not null then
    v_out := regexp_replace(
      v_out,
      '(?:https?://)?(?:www\.)?' || regexp_replace(p_label, '([.*+?^${}()|\[\]\\])', '\\\1', 'g')
        || '\.[a-z]{2,}(?:\.[a-z]{2,})?(?:/\S*)?',
      'the provider''s website',
      'gi'
    );
  end if;
  if coalesce(cardinality(p_terms), 0) = 0 then
    return v_out;
  end if;

  -- Cheap exit, and exact: a matching run's compact form is a substring of the text's.
  v_compact := public.identity_compact(v_out);
  foreach v_term in array p_terms loop
    if strpos(v_compact, v_term) > 0 then
      v_hit := true;
      exit;
    end if;
  end loop;
  if not v_hit then
    return v_out;
  end if;

  -- Tokens with their positions (ends are exclusive).
  v_pos := 1;
  loop
    v_s := regexp_instr(v_out, c_word, v_pos);
    exit when v_s = 0;
    v_pos := regexp_instr(v_out, c_word, v_pos, 1, 1);
    v_starts := v_starts || v_s;
    v_ends := v_ends || v_pos;
  end loop;
  v_n := cardinality(v_starts);

  -- Longest run first, up to eight words, joined over spaces, "&", "+" and hyphens only.
  v_i := 1;
  while v_i <= v_n loop
    v_matched := false;
    for v_len in reverse least(8, v_n - v_i + 1) .. 1 loop
      v_joined := true;
      for v_k in v_i + 1 .. v_i + v_len - 1 loop
        if substr(v_out, v_ends[v_k - 1], v_starts[v_k] - v_ends[v_k - 1]) !~ '^[\s&+-]*$' then
          v_joined := false;
          exit;
        end if;
      end loop;
      if v_joined and public.identity_compact(
        substr(v_out, v_starts[v_i], v_ends[v_i + v_len - 1] - v_starts[v_i])
      ) = any (p_terms) then
        v_span_s := v_span_s || v_starts[v_i];
        v_span_e := v_span_e || v_ends[v_i + v_len - 1];
        v_i := v_i + v_len;
        v_matched := true;
        exit;
      end if;
    end loop;
    if not v_matched then
      v_i := v_i + 1;
    end if;
  end loop;
  if cardinality(v_span_s) = 0 then
    return v_out;
  end if;

  for v_k in 1 .. cardinality(v_span_s) loop
    v_before := substr(v_out, v_cursor, v_span_s[v_k] - v_cursor);
    v_poss := substring(substr(v_out, v_span_e[v_k]) from '^[''’][sS]\M');
    if v_poss is not null then
      v_repl := 'the provider''s';
      v_span_e[v_k] := v_span_e[v_k] + length(v_poss);
    elsif (v_result || v_before) ~* '\m(?:at|from|with|by|to|for|of|in|visit|visiting)\s+$' then
      v_repl := 'this provider';
    else
      v_repl := '';
    end if;
    v_result := v_result || v_before || v_repl;
    v_cursor := v_span_e[v_k];
  end loop;
  v_result := v_result || substr(v_out, v_cursor);

  v_result := regexp_replace(v_result, '[ \t]{2,}', ' ', 'g');
  v_result := regexp_replace(v_result, ' +([,.;:!?)])', '\1', 'g');
  v_result := regexp_replace(v_result, '\(\s*\)', '', 'g');
  v_result := regexp_replace(v_result, '^[\s,;:—–-]+', '');
  v_result := regexp_replace(v_result, '^\s+|\s+$', '', 'g');
  -- The name led the sentence: "NakedMD members club..." still starts with a capital.
  if v_span_s[1] = 1 and v_result ~ '^[[:lower:]]' then
    v_result := upper(left(v_result, 1)) || substr(v_result, 2);
  end if;
  return v_result;
end;
$fn$;

-- The one-call form, for anything scrubbing a single text: scrub_provider_identity(text, the
-- clinic's name, its website, its city).
create or replace function public.scrub_provider_identity(
  p_text text,
  p_name text,
  p_website text,
  p_city text default null
)
returns text
language sql
stable
parallel safe
return public.scrub_identity_terms(
  p_text,
  public.provider_identity_terms(p_name, p_website, p_city),
  public.provider_site_label(p_website)
);

-- ---------------------------------------------------------------------------------------------
-- 2. public_offers
-- ---------------------------------------------------------------------------------------------

create or replace view public.public_offers as
select
  o.id,
  public.scrub_identity_terms(o.offer_raw_text, t.terms, t.label) as offer_raw_text,
  o.discount_percent,
  o.discount_amount,
  o.regular_price,
  o.discount_price,
  o.is_membership_required,
  o.created_at,
  o.business_id,
  -- Kept for the row shape, withheld: each joins to a clinic table.
  null::bigint as membership_plan_id,
  null::text as offer_fingerprint,
  null::bigint as promotion_id,
  o.is_active,
  o.is_new_customer_required,
  o.price_model,
  o.updated_at,
  case when o.conditions is not null then coalesce(
    (
      select array_agg(public.scrub_identity_terms(c.value, t.terms, t.label) order by c.n)
        from unnest(o.conditions) with ordinality as c(value, n)
    ),
    '{}'
  ) end as conditions,
  o.is_package,
  b.city as business_city,
  public.address_state_code(b.address) as business_state,
  p.campaign_start_date,
  p.campaign_end_date,
  x.promotion_title,
  x.membership_name,
  m.membership_price,
  m.billing_period,
  m.minimum_commitment_months,
  coalesce(items.list, '[]'::jsonb) as promo_offer_items,
  case when p.promotion_id is not null then jsonb_build_object(
    'promotion_title', x.promotion_title,
    'campaign_start_date', p.campaign_start_date,
    'campaign_end_date', p.campaign_end_date,
    'source_url', null
  ) end as clinic_promotions,
  case when m.plan_id is not null then jsonb_build_object(
    'membership_name', x.membership_name,
    'membership_price', m.membership_price,
    'billing_period', m.billing_period,
    'minimum_commitment_months', m.minimum_commitment_months
  ) end as clinic_memberships,
  case when b.business_id is not null then jsonb_build_object(
    'business_id', b.business_id,
    'city', b.city,
    'name', null,
    'website', null,
    'address', null,
    'score', null,
    'review_count', null,
    'category', null
  ) end as master_business_info
from public.promo_offer_master o
left join public.master_business_info b on b.business_id = o.business_id
left join public.clinic_promotions p on p.promotion_id = o.promotion_id
left join public.clinic_memberships m on m.plan_id = o.membership_plan_id
-- The clinic's identity terms and site label once per row, not once per scrubbed field. OFFSET 0
-- keeps the planner from pulling the calls up into every expression that reads them.
cross join lateral (
  select
    public.provider_identity_terms(b.name, b.website, b.city) as terms,
    public.provider_site_label(b.website) as label
  offset 0
) t
cross join lateral (
  select
    public.scrub_identity_terms(p.promotion_title, t.terms, t.label) as promotion_title,
    case
      when public.scrub_identity_terms(m.membership_name, t.terms, t.label)
           = m.membership_name
      then m.membership_name
    end as membership_name
) x
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'offer_item_id', i.offer_item_id,
      'item_name', public.scrub_identity_terms(i.item_name, t.terms, t.label),
      'delivered_units', i.delivered_units,
      'unit_price', i.unit_price,
      'clinic_services', case when s.service_id is not null then jsonb_build_object(
        'service_category', s.service_category,
        'unit_type', s.unit_type,
        'service_area', s.service_area,
        'source_url', null
      ) end
    )
    order by i.offer_item_id
  ) as list
  from public.promo_offer_items i
  left join public.clinic_services s on s.service_id = i.service_id
  where i.offer_id = o.id
) items on true
where o.is_active;

alter view public.public_offers owner to postgres;
revoke all on public.public_offers from public, anon, authenticated;
grant select on public.public_offers to anon, authenticated;

comment on view public.public_offers is
  'The public offer catalogue: active offers with the clinic''s identity scrubbed out. The only '
  'offer relation anon may read. See 20260924050001_public_catalogue_views.sql.';

-- ---------------------------------------------------------------------------------------------
-- 3. public_business_directory
-- ---------------------------------------------------------------------------------------------

create or replace view public.public_business_directory as
select
  b.name,
  b.address,
  b.city,
  public.address_state_code(b.address) as business_state,
  b.score,
  b.review_count,
  b.category,
  -- businessToProvider()'s slug: lowercase, runs of anything else to "-", no leading/trailing "-".
  trim(both '-' from regexp_replace(lower(coalesce(b.name, '')), '[^a-z0-9]+', '-', 'g')) as slug
from public.master_business_info b;

alter view public.public_business_directory owner to postgres;
revoke all on public.public_business_directory from public, anon, authenticated;
grant select on public.public_business_directory to anon, authenticated;

comment on view public.public_business_directory is
  'The public provider directory. No business_id, so nothing joins it to an offer. See '
  '20260924050001_public_catalogue_views.sql.';

-- ---------------------------------------------------------------------------------------------
-- 4. Count RPCs: SECURITY DEFINER so they survive step B
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_business_cities()
returns table(city text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select b.city, count(*) as count
    from public.master_business_info b
   where b.city is not null
     and trim(b.city) <> ''
   group by b.city
   order by count(*) desc;
$$;

create or replace function public.get_business_count_for_city(city_name text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
    from public.master_business_info
   where city ilike city_name;
$$;

create or replace function public.get_business_category_counts()
returns table(category text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select category, count(*) as count
    from public.master_business_info
   where category is not null
   group by category
   order by count desc;
$$;

create or replace function public.get_city_deal_counts()
returns table(city text, deal_count bigint, provider_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.city,
    count(o.id) as deal_count,
    count(distinct o.business_id) as provider_count
  from public.promo_offer_master o
  join public.master_business_info b on o.business_id = b.business_id
  -- As SECURITY INVOKER the anon policy (is_active = true) applied this implicitly.
  where o.is_active
    and (o.discount_price > 0 or o.regular_price > 0)
    and b.city is not null
    and trim(b.city) <> ''
  group by b.city
  order by deal_count desc;
$$;

create or replace function public.get_offer_category_counts()
returns table(service_category text, count bigint, provider_ids bigint[])
language sql
stable
security definer
set search_path = ''
as $$
  with canonical as (
    select distinct on (i.offer_id)
           i.offer_id,
           s.service_category
      from public.promo_offer_items i
      join public.clinic_services s on s.service_id = i.service_id
     where s.service_category is not null
     order by i.offer_id, i.offer_item_id
  )
  select c.service_category::text,
         count(*) as count,
         coalesce(
           array_agg(distinct m.business_id) filter (where m.business_id is not null),
           '{}'::bigint[]
         ) as provider_ids
    from public.promo_offer_master m
    join canonical c on c.offer_id = m.id
    left join public.clinic_promotions p on p.promotion_id = m.promotion_id
   where m.is_active
     and (p.campaign_end_date is null or p.campaign_end_date >= current_date)
     -- Mirrors the consumer-browse predicate in src/lib/data/offers.ts. A stated discount IS
     -- pricing data. Keep the last two terms in step with that file.
     and (coalesce(m.discount_price, 0) > 0
          or coalesce(m.regular_price, 0) > 0
          or coalesce(m.discount_percent, 0) > 0
          or coalesce(m.discount_amount, 0) > 0)
   group by c.service_category
   order by 2 desc;
$$;

alter function public.get_business_cities() owner to postgres;
alter function public.get_business_count_for_city(text) owner to postgres;
alter function public.get_business_category_counts() owner to postgres;
alter function public.get_city_deal_counts() owner to postgres;
alter function public.get_offer_category_counts() owner to postgres;

-- ---------------------------------------------------------------------------------------------
-- 5. Authenticated readers that lean on the public policies today
-- ---------------------------------------------------------------------------------------------

create policy "Admins can read all clinic services"
  on public.clinic_services for select to authenticated
  using ((select private.is_admin()));
create policy "Owners can read their business services"
  on public.clinic_services for select to authenticated
  using (exists (
    select 1 from public.business_profiles bp
     where bp.id = (select auth.uid())
       and bp.business_id = clinic_services.business_id
       and bp.claim_status = 'approved'
  ));

create policy "Admins can read all clinic promotions"
  on public.clinic_promotions for select to authenticated
  using ((select private.is_admin()));
create policy "Owners can read their business promotions"
  on public.clinic_promotions for select to authenticated
  using (exists (
    select 1 from public.business_profiles bp
     where bp.id = (select auth.uid())
       and bp.business_id = clinic_promotions.business_id
       and bp.claim_status = 'approved'
  ));

create policy "Admins can read all clinic memberships"
  on public.clinic_memberships for select to authenticated
  using ((select private.is_admin()));
create policy "Owners can read their business memberships"
  on public.clinic_memberships for select to authenticated
  using (exists (
    select 1 from public.business_profiles bp
     where bp.id = (select auth.uid())
       and bp.business_id = clinic_memberships.business_id
       and bp.claim_status = 'approved'
  ));

create policy "Admins can read all businesses"
  on public.master_business_info for select to authenticated
  using ((select private.is_admin()));
create policy "Owners can read their business"
  on public.master_business_info for select to authenticated
  using (exists (
    select 1 from public.business_profiles bp
     where bp.id = (select auth.uid())
       and bp.business_id = master_business_info.business_id
       and bp.claim_status = 'approved'
  ));
create policy "Claimants can read the clinics they claimed"
  on public.master_business_info for select to authenticated
  using (exists (
    select 1 from public.claims c
     where c.consumer_id = (select auth.uid())
       and c.business_id = master_business_info.business_id
  ));

notify pgrst, 'reload schema';
