-- Pedidos Internos: vários documentos por pedido e eliminação em qualquer fase
-- por administradores ou perfis com a permissão finance.requests.delete.

-- 1. Permissão granular de eliminação (mesmo formato de has_finance_approve_permission)
CREATE OR REPLACE FUNCTION public.has_finance_request_delete_permission(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN organization_profiles op ON op.id = om.profile_id
    WHERE om.user_id = _user_id
      AND om.organization_id = get_user_org_id(_user_id)
      AND (op.module_permissions->'finance'->'subareas'->'requests'->'delete')::text = 'true'
  )
$$;

-- 2. Quem pode ver o pedido (submissor, admins e aprovadores da mesma organização)
CREATE OR REPLACE FUNCTION public.can_view_internal_request(_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_requests r
    WHERE r.id = _request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND (
        r.submitted_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_finance_approve_permission(auth.uid())
      )
  )
$$;

-- 3. Quem pode eliminar o pedido/documentos em qualquer fase
CREATE OR REPLACE FUNCTION public.can_delete_any_internal_request(_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_requests r
    WHERE r.id = _request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_finance_request_delete_permission(auth.uid())
      )
  )
$$;

-- 4. Tabela de documentos
CREATE TABLE IF NOT EXISTS public.internal_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.internal_requests(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_request_attachments_request ON public.internal_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_internal_request_attachments_path ON public.internal_request_attachments(file_path);

ALTER TABLE public.internal_request_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View attachments of visible requests" ON public.internal_request_attachments;
CREATE POLICY "View attachments of visible requests"
ON public.internal_request_attachments FOR SELECT TO authenticated
USING (public.can_view_internal_request(request_id));

-- Submissor acrescenta enquanto o pedido está pendente; admins/aprovadores em qualquer fase
DROP POLICY IF EXISTS "Add attachments to requests" ON public.internal_request_attachments;
CREATE POLICY "Add attachments to requests"
ON public.internal_request_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND organization_id = public.get_user_org_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.internal_requests r
    WHERE r.id = request_id
      AND r.organization_id = internal_request_attachments.organization_id
      AND (
        (r.submitted_by = auth.uid() AND r.status = 'pending')
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_finance_approve_permission(auth.uid())
      )
  )
);

-- Submissor remove os seus documentos enquanto pendente; autorizados em qualquer fase
DROP POLICY IF EXISTS "Delete attachments of requests" ON public.internal_request_attachments;
CREATE POLICY "Delete attachments of requests"
ON public.internal_request_attachments FOR DELETE TO authenticated
USING (
  public.can_delete_any_internal_request(request_id)
  OR (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.internal_requests r
      WHERE r.id = request_id
        AND r.submitted_by = auth.uid()
        AND r.status = 'pending'
        AND r.organization_id = public.get_user_org_id(auth.uid())
    )
  )
);

-- 5. Eliminar o pedido em qualquer fase (o submissor continua a poder eliminar os seus pendentes)
DROP POLICY IF EXISTS "Authorized users can delete any request" ON public.internal_requests;
CREATE POLICY "Authorized users can delete any request"
ON public.internal_requests FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_finance_request_delete_permission(auth.uid())
  )
);

-- 6. Storage: ler/remover ficheiros pelo pedido a que pertencem (limitado à organização)
CREATE OR REPLACE FUNCTION public.can_read_internal_request_file(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_request_attachments a
    WHERE a.file_path = _name AND can_view_internal_request(a.request_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_delete_internal_request_file(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_request_attachments a
    JOIN internal_requests r ON r.id = a.request_id
    WHERE a.file_path = _name
      AND (
        can_delete_any_internal_request(a.request_id)
        OR (r.submitted_by = auth.uid() AND r.status = 'pending'
            AND r.organization_id = get_user_org_id(auth.uid()))
      )
  )
$$;

-- A política antiga deixava admins de qualquer organização ler todos os ficheiros do bucket
DROP POLICY IF EXISTS "Users can view their own files or admins view all" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own or authorized request files" ON storage.objects;
CREATE POLICY "Users can view own or authorized request files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'internal-requests'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.can_read_internal_request_file(name)
  )
);

DROP POLICY IF EXISTS "Authorized users can delete request files" ON storage.objects;
CREATE POLICY "Authorized users can delete request files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'internal-requests'
  AND public.can_delete_internal_request_file(name)
);

-- 7. Copiar o anexo único antigo (file_url) para a nova tabela
INSERT INTO public.internal_request_attachments
  (organization_id, request_id, file_path, file_name, uploaded_by, created_at)
SELECT r.organization_id,
       r.id,
       substring(r.file_url from '/internal-requests/([^?]+)'),
       regexp_replace(substring(r.file_url from '/internal-requests/([^?]+)'), '^.*/', ''),
       r.submitted_by,
       COALESCE(r.submitted_at, r.created_at, now())
FROM public.internal_requests r
WHERE r.file_url IS NOT NULL
  AND substring(r.file_url from '/internal-requests/([^?]+)') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_request_attachments a WHERE a.request_id = r.id
  );

NOTIFY pgrst, 'reload schema';
