CREATE OR REPLACE FUNCTION public.handle_email_unsubscribe(p_token text)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_row public.email_unsubscribe_tokens%ROWTYPE;
  v_removed_list_id uuid;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN QUERY SELECT false, 'Link inválido.'::text;
    RETURN;
  END IF;

  SELECT * INTO v_token_row
  FROM public.email_unsubscribe_tokens
  WHERE token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Link inválido ou expirado.'::text;
    RETURN;
  END IF;

  UPDATE public.marketing_contacts
  SET subscribed = false,
      updated_at = now()
  WHERE id = v_token_row.contact_id;

  v_removed_list_id := public.ensure_newsletter_removed_list(v_token_row.organization_id);

  IF v_removed_list_id IS NOT NULL THEN
    INSERT INTO public.marketing_list_members (list_id, contact_id)
    VALUES (v_removed_list_id, v_token_row.contact_id)
    ON CONFLICT (list_id, contact_id) DO NOTHING;
  END IF;

  IF v_token_row.email_send_id IS NOT NULL THEN
    UPDATE public.email_sends
    SET status = 'unsubscribed'
    WHERE id = v_token_row.email_send_id
      AND status <> 'unsubscribed';
  END IF;

  UPDATE public.email_unsubscribe_tokens
  SET used_at = COALESCE(used_at, now())
  WHERE id = v_token_row.id;

  RETURN QUERY SELECT true, 'Subscrição cancelada com sucesso.'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_email_unsubscribe(text) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_email_unsubscribe(text) TO authenticated;