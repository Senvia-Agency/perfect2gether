-- Supabase default privileges may explicitly grant API roles EXECUTE.
-- Trigger execution remains available through the protected table operations.
REVOKE ALL ON FUNCTION public.require_p2g_rejection_meeting() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p2g_assert_unique_cpe() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p2g_commitment_calendar_month() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_p2g_proposal_with_meeting(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_p2g_proposal_with_meeting(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
