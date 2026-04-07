-- Fix RLS policies on rh_absences to allow super_admins

DROP POLICY IF EXISTS rh_absences_insert ON rh_absences;
CREATE POLICY rh_absences_insert ON rh_absences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (is_org_member(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS rh_absences_select ON rh_absences;
CREATE POLICY rh_absences_select ON rh_absences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_org_member(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS rh_absences_update ON rh_absences;
CREATE POLICY rh_absences_update ON rh_absences FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR is_org_admin(auth.uid(), organization_id)
    OR has_role(auth.uid(), 'super_admin')
  );

-- Also fix rh_absence_periods for consistency
DROP POLICY IF EXISTS rh_absence_periods_insert ON rh_absence_periods;
CREATE POLICY rh_absence_periods_insert ON rh_absence_periods FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rh_absences a
      WHERE a.id = absence_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rh_absence_periods_select ON rh_absence_periods;
CREATE POLICY rh_absence_periods_select ON rh_absence_periods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rh_absences a
      WHERE a.id = absence_id
        AND (a.user_id = auth.uid() OR is_org_member(auth.uid(), a.organization_id) OR has_role(auth.uid(), 'super_admin'))
    )
  );