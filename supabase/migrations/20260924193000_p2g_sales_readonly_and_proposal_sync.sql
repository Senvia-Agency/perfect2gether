-- P2G: a conversão de proposta e venda é uma única operação lógica.
-- A atualização da proposta feita pelo browser depois do INSERT falhava para
-- comerciais porque a proposta já convertida fica bloqueada para alterações.

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_p2g_proposal_before_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
     OR NEW.proposal_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.proposals
  SET status = 'accepted',
      accepted_at = COALESCE(accepted_at, now())
  WHERE id = NEW.proposal_id
    AND organization_id = NEW.organization_id
    AND (status IS DISTINCT FROM 'accepted' OR accepted_at IS NULL);

  IF NOT EXISTS (
    SELECT 1 FROM public.proposals
    WHERE id = NEW.proposal_id AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'A proposta da venda não pertence à organização';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accept_p2g_proposal_before_sale ON public.sales;
CREATE TRIGGER trg_accept_p2g_proposal_before_sale
  BEFORE INSERT OR UPDATE OF proposal_id ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.accept_p2g_proposal_before_sale();

-- Mesmo Back Office/admin não podem regressar a "Em negociação" enquanto a
-- proposta estiver ligada a uma venda.
CREATE OR REPLACE FUNCTION public.enforce_p2g_converted_proposal_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
     AND NEW.status IS DISTINCT FROM 'accepted'
     AND EXISTS (SELECT 1 FROM public.sales WHERE proposal_id = NEW.id) THEN
    RAISE EXCEPTION 'Uma proposta convertida em venda tem de permanecer aceite';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_p2g_converted_proposal_status ON public.proposals;
CREATE TRIGGER trg_enforce_p2g_converted_proposal_status
  BEFORE UPDATE OF status ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_p2g_converted_proposal_status();

-- Uma proposta não pode gerar duas vendas, inclusive em cliques simultâneos.
CREATE UNIQUE INDEX IF NOT EXISTS sales_p2g_one_sale_per_proposal
  ON public.sales (proposal_id)
  WHERE organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    AND proposal_id IS NOT NULL;

-- Os perfis comerciais consultam vendas, mas o acompanhamento é do BO.
UPDATE public.organization_profiles
SET module_permissions = jsonb_set(
  module_permissions,
  '{sales,subareas,sales,edit}',
  'false'::jsonb,
  true
)
WHERE organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND name IN ('Comercial', 'CE', 'Diretor Comercial');

DROP POLICY IF EXISTS p2g_manage_sales_only_back_office ON public.sales;
CREATE POLICY p2g_manage_sales_only_back_office ON public.sales
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  )
  WITH CHECK (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  );

DROP POLICY IF EXISTS p2g_manage_sale_items_only_back_office ON public.sale_items;
DROP POLICY IF EXISTS p2g_insert_sale_items_only_back_office ON public.sale_items;
CREATE POLICY p2g_insert_sale_items_only_back_office ON public.sale_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    )
    OR public.can_manage_sales_for_organization('96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid)
  );

DROP POLICY IF EXISTS p2g_update_sale_items_only_back_office ON public.sale_items;
CREATE POLICY p2g_update_sale_items_only_back_office ON public.sale_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    )
    OR public.can_manage_sales_for_organization('96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid)
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    )
    OR public.can_manage_sales_for_organization('96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid)
  );

DROP POLICY IF EXISTS p2g_delete_sale_items_only_back_office ON public.sale_items;
CREATE POLICY p2g_delete_sale_items_only_back_office ON public.sale_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    )
    OR public.can_manage_sales_for_organization('96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid)
  );

DROP POLICY IF EXISTS p2g_manage_sale_payments_only_back_office ON public.sale_payments;
DROP POLICY IF EXISTS p2g_insert_sale_payments_only_back_office ON public.sale_payments;
CREATE POLICY p2g_insert_sale_payments_only_back_office ON public.sale_payments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  );

DROP POLICY IF EXISTS p2g_update_sale_payments_only_back_office ON public.sale_payments;
CREATE POLICY p2g_update_sale_payments_only_back_office ON public.sale_payments
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  )
  WITH CHECK (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  );

DROP POLICY IF EXISTS p2g_delete_sale_payments_only_back_office ON public.sale_payments;
CREATE POLICY p2g_delete_sale_payments_only_back_office ON public.sale_payments
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  );

DROP POLICY IF EXISTS p2g_manage_activation_history_only_back_office ON public.sale_activation_history;
CREATE POLICY p2g_manage_activation_history_only_back_office ON public.sale_activation_history
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.can_manage_sales_for_organization(organization_id)
  );

-- Corrigir apenas a divergência histórica encontrada, sem disparar novamente
-- notificações de automação para uma venda já criada.
ALTER TABLE public.proposals DISABLE TRIGGER trg_lock_converted_proposal_for_salespeople;
ALTER TABLE public.proposals DISABLE TRIGGER trigger_automation_proposals;

UPDATE public.proposals p
SET status = 'accepted',
    accepted_at = COALESCE(p.accepted_at, s.created_at)
FROM public.sales s
WHERE s.proposal_id = p.id
  AND p.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND p.status IS DISTINCT FROM 'accepted';

ALTER TABLE public.proposals ENABLE TRIGGER trigger_automation_proposals;
ALTER TABLE public.proposals ENABLE TRIGGER trg_lock_converted_proposal_for_salespeople;

COMMIT;
