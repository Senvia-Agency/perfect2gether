
-- Super admin can read ALL announcements (including inactive)
CREATE POLICY "Super admins can read all announcements"
  ON public.app_announcements
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can insert
CREATE POLICY "Super admins can insert announcements"
  ON public.app_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can update
CREATE POLICY "Super admins can update announcements"
  ON public.app_announcements
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can delete
CREATE POLICY "Super admins can delete announcements"
  ON public.app_announcements
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
