-- Ensure a dedicated system list for unsubscribed newsletter contacts
CREATE OR REPLACE FUNCTION public.ensure_newsletter_removed_list(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  SELECT id INTO v_list_id
  FROM public.client_lists
  WHERE organization_id = p_org_id
    AND name = 'Removidos da Newsletter'
    AND is_system = true
  LIMIT 1;

  IF v_list_id IS NULL THEN
    INSERT INTO public.client_lists (
      organization_id,
      name,
      description,
      is_dynamic,
      is_system
    ) VALUES (
      p_org_id,
      'Removidos da Newsletter',
      'Contactos que cancelaram a subscrição de newsletters.',
      false,
      true
    )
    RETURNING id INTO v_list_id;
  END IF;

  RETURN v_list_id;
END;
$$;

-- Extend existing auto-lists setup to also guarantee unsubscribe list
CREATE OR REPLACE FUNCTION public.ensure_org_auto_lists(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Leads Novos', 'Leads na primeira etapa do pipeline', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Leads Novos' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Clientes', 'Leads convertidos em clientes', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Clientes' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Leads Não Convertidas', 'Leads em etapa final negativa', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Leads Não Convertidas' AND is_system = true
  );

  PERFORM public.ensure_newsletter_removed_list(p_org_id);
END;
$$;

-- Public unsubscribe tokens table
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  email_send_id uuid NULL REFERENCES public.email_sends(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone NULL
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribe_tokens_token
  ON public.email_unsubscribe_tokens (token);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribe_tokens_contact
  ON public.email_unsubscribe_tokens (contact_id, organization_id);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));