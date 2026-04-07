CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  active_org UUID;
  jwt_claims JSON;
BEGIN
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::json;
    active_org := COALESCE(
      (jwt_claims->'app_metadata'->>'active_organization_id')::UUID,
      (jwt_claims->'user_metadata'->>'active_organization_id')::UUID
    );
  EXCEPTION WHEN OTHERS THEN
    active_org := NULL;
  END;
  
  IF active_org IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = _user_id AND organization_id = active_org AND is_active = true
    ) OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = _user_id AND role = 'super_admin'
    ) THEN
      RETURN active_org;
    END IF;
  END IF;
  
  SELECT om.organization_id INTO active_org
  FROM organization_members om
  WHERE om.user_id = _user_id AND om.is_active = true
  ORDER BY om.joined_at ASC
  LIMIT 1;
  
  IF active_org IS NOT NULL THEN
    RETURN active_org;
  END IF;
  
  SELECT p.organization_id INTO active_org
  FROM profiles p
  WHERE p.id = _user_id;
  
  RETURN active_org;
END;
$function$;