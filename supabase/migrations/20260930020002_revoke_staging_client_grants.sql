-- revoke_staging_client_grants: the website's roles get nothing on the pipeline's staging tables.
--
-- WHY
-- promo_email_staging granted anon and authenticated SELECT; promo_social_staging granted
-- authenticated INSERT/UPDATE/DELETE/REFERENCES/TRIGGER and anon REFERENCES/TRIGGER (its SELECT
-- and public-read policy went in 20260924050002). RLS is on with no policies, so every one of those
-- was already refused. This removes the grants so RLS is not the only guard ("Grants are not RLS",
-- CLAUDE.md; data contract §5.5). Nothing in src/ reads either table; the pipeline writes them as
-- postgres/service_role and is unaffected.
--
-- ROLLBACK:
--   grant select on public.promo_email_staging to anon, authenticated;
--   grant insert, update, delete, references, trigger on public.promo_social_staging to authenticated;
--   grant references, trigger on public.promo_social_staging to anon;

revoke all on public.promo_email_staging, public.promo_social_staging from anon, authenticated;

notify pgrst, 'reload schema';
