-- Permitir admins ver roles dos membros da sua organização
CREATE POLICY "Admins view org member roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  -- O utilizador tem role admin na mesma organização que o target user
  EXISTS (
    SELECT 1 
    FROM public.profiles admin_profile
    JOIN public.profiles target_profile ON target_profile.id = user_roles.user_id
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.organization_id = target_profile.organization_id
      AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  OR
  -- Super admin pode ver tudo (já está coberto por outra policy, mas mantemos para clareza)
  public.has_role(auth.uid(), 'super_admin'::app_role)
);