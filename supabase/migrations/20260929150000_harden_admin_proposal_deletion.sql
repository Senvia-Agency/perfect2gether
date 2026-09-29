-- Bring the already-installed RPC to the tighter P2G admin and sale-lock rules.
-- The P2G administrator can remove a cancelled sale with its proposal in one
-- transaction. Financial documents and active sales must be handled separately.
CREATE OR REPLACE FUNCTION public.delete_cancelled_p2g_proposal(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  p2g_org constant uuid := '96a3950e-31be-4c6d-abed-b82968c0d7e9';
  proposal_org uuid;
  sale_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p2g_org
      AND om.is_active
      AND (om.role = 'admin' OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
      ))
  ) OR NOT public.p2g_mfa_ok() THEN
    RAISE insufficient_privilege USING MESSAGE = 'Apenas um administrador do P2G com 2FA verificado pode eliminar esta proposta.';
  END IF;

  SELECT organization_id INTO proposal_org
  FROM public.proposals
  WHERE id = p_proposal_id
  FOR UPDATE;
  IF proposal_org IS DISTINCT FROM p2g_org THEN
    RAISE no_data_found USING MESSAGE = 'Proposta P2G não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.commitment_lines WHERE proposal_id = p_proposal_id
  ) THEN
    RAISE check_violation USING MESSAGE = 'A proposta está ligada a um compromisso.';
  END IF;

  SELECT count(*) INTO sale_count FROM public.sales WHERE proposal_id = p_proposal_id;
  IF sale_count > 1 THEN
    RAISE check_violation USING MESSAGE = 'A proposta tem várias vendas associadas.';
  END IF;
  IF sale_count = 1 THEN
    PERFORM 1 FROM public.sales WHERE proposal_id = p_proposal_id FOR UPDATE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.proposal_id = p_proposal_id
      AND (s.organization_id IS DISTINCT FROM p2g_org
        OR s.status IS DISTINCT FROM 'cancelled'
        OR s.invoicexpress_id IS NOT NULL
        OR s.invoice_reference IS NOT NULL
        OR s.credit_note_id IS NOT NULL
        OR s.credit_note_reference IS NOT NULL
        OR s.paid_date IS NOT NULL
        OR s.payment_status = 'paid')
  ) OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.sales s ON s.id = i.sale_id WHERE s.proposal_id = p_proposal_id
  ) OR EXISTS (
    SELECT 1 FROM public.credit_notes c JOIN public.sales s ON s.id = c.sale_id WHERE s.proposal_id = p_proposal_id
  ) OR EXISTS (
    SELECT 1 FROM public.stripe_commission_records c JOIN public.sales s ON s.id = c.sale_id WHERE s.proposal_id = p_proposal_id
  ) OR EXISTS (
    SELECT 1 FROM public.sale_payments sp JOIN public.sales s ON s.id = sp.sale_id WHERE s.proposal_id = p_proposal_id
  ) OR EXISTS (
    SELECT 1 FROM public.sale_activation_history h JOIN public.sales s ON s.id = h.sale_id WHERE s.proposal_id = p_proposal_id
  ) OR EXISTS (
    SELECT 1 FROM public.renewal_automation_runs r JOIN public.sales s ON s.id = r.sale_id WHERE s.proposal_id = p_proposal_id
  ) THEN
    RAISE check_violation USING MESSAGE = 'A venda associada deve estar cancelada e sem documentos, pagamentos ou histórico de ativação.';
  END IF;

  DELETE FROM public.sales WHERE proposal_id = p_proposal_id AND organization_id = p2g_org;
  DELETE FROM public.proposals WHERE id = p_proposal_id AND organization_id = p2g_org;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_cancelled_p2g_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_cancelled_p2g_proposal(uuid) TO authenticated;
