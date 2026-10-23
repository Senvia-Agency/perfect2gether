-- Scope only the initial state of P2G sales created from a proposal.
-- Existing sale UPDATE policies/triggers and creation permissions remain unchanged.
CREATE FUNCTION public.enforce_p2g_proposal_sale_initial_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    AND NEW.proposal_id IS NOT NULL
    AND NEW.status IS DISTINCT FROM 'fulfilled'
    AND public.can_manage_sales_for_organization(NEW.organization_id) IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id
      WHERE m.user_id=auth.uid() AND m.organization_id=NEW.organization_id
        AND m.is_active=true AND p.base_role='admin'
    ) THEN
    RAISE EXCEPTION 'Ao criar uma venda pela proposta, selecione apenas Entregue.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_p2g_proposal_sale_initial_status
BEFORE INSERT ON public.sales FOR EACH ROW
EXECUTE FUNCTION public.enforce_p2g_proposal_sale_initial_status();
