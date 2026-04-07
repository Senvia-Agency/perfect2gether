
-- Absence type enum
DO $$ BEGIN
  CREATE TYPE public.rh_absence_type AS ENUM ('vacation', 'sick_leave', 'appointment', 'personal_leave', 'training', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rh_absence_status AS ENUM ('pending', 'approved', 'partially_approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.rh_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  absence_type text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'pending',
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_absence_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id uuid NOT NULL REFERENCES public.rh_absences(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  business_days numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  period_type text NOT NULL DEFAULT 'full_day',
  start_time text,
  end_time text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_vacation_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  total_days numeric NOT NULL DEFAULT 22,
  used_days numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, year)
);

CREATE TABLE public.rh_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  year integer NOT NULL,
  is_national boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_absences_org ON public.rh_absences(organization_id);
CREATE INDEX idx_rh_absences_user ON public.rh_absences(user_id);
CREATE INDEX idx_rh_absence_periods_absence ON public.rh_absence_periods(absence_id);
CREATE INDEX idx_rh_vacation_balances_org_user ON public.rh_vacation_balances(organization_id, user_id, year);
CREATE INDEX idx_rh_holidays_org_year ON public.rh_holidays(organization_id, year);

ALTER TABLE public.rh_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_absence_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_vacation_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_absences_select" ON public.rh_absences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "rh_absences_insert" ON public.rh_absences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "rh_absences_update" ON public.rh_absences
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR public.is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "rh_absences_delete" ON public.rh_absences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "rh_absence_periods_select" ON public.rh_absence_periods
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rh_absences a WHERE a.id = absence_id AND (a.user_id = auth.uid() OR public.is_org_member(auth.uid(), a.organization_id))
  ));

CREATE POLICY "rh_absence_periods_insert" ON public.rh_absence_periods
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rh_absences a WHERE a.id = absence_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "rh_absence_periods_delete" ON public.rh_absence_periods
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rh_absences a WHERE a.id = absence_id AND a.user_id = auth.uid() AND a.status = 'pending'
  ));

CREATE POLICY "rh_absence_periods_admin" ON public.rh_absence_periods
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rh_absences a WHERE a.id = absence_id AND public.is_org_admin(auth.uid(), a.organization_id)
  ));

CREATE POLICY "rh_vacation_balances_select" ON public.rh_vacation_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "rh_vacation_balances_admin" ON public.rh_vacation_balances
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "rh_holidays_select" ON public.rh_holidays
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "rh_holidays_admin" ON public.rh_holidays
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Trigger for vacation balance auto-update
CREATE OR REPLACE FUNCTION public.rh_update_vacation_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_days numeric;
BEGIN
  IF NEW.absence_type != 'vacation' THEN RETURN NEW; END IF;

  IF NEW.status IN ('approved', 'partially_approved') AND OLD.status = 'pending' THEN
    SELECT COALESCE(SUM(p.business_days), 0) INTO v_total_days
    FROM public.rh_absence_periods p WHERE p.absence_id = NEW.id AND p.status != 'rejected';

    UPDATE public.rh_vacation_balances
    SET used_days = used_days + v_total_days, updated_at = now()
    WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  IF OLD.status IN ('approved', 'partially_approved') AND NEW.status IN ('pending', 'rejected') THEN
    SELECT COALESCE(SUM(p.business_days), 0) INTO v_total_days
    FROM public.rh_absence_periods p WHERE p.absence_id = NEW.id AND p.status != 'rejected';

    UPDATE public.rh_vacation_balances
    SET used_days = GREATEST(0, used_days - v_total_days), updated_at = now()
    WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rh_update_vacation_balance
  AFTER UPDATE OF status ON public.rh_absences
  FOR EACH ROW
  EXECUTE FUNCTION public.rh_update_vacation_balance();
