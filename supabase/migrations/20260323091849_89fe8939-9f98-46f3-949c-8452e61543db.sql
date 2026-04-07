
CREATE OR REPLACE FUNCTION public.rh_update_vacation_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_days numeric;
BEGIN
  IF NEW.absence_type != 'vacation' THEN RETURN NEW; END IF;

  IF NEW.status IN ('approved', 'partially_approved') AND OLD.status = 'pending' THEN
    SELECT COALESCE(SUM(p.business_days), 0) INTO v_total_days
    FROM public.rh_absence_periods p WHERE p.absence_id = NEW.id AND p.status != 'rejected';

    -- Upsert: create balance with default 22 days if not exists, then add used_days
    INSERT INTO public.rh_vacation_balances (organization_id, user_id, year, total_days, used_days)
    VALUES (NEW.organization_id, NEW.user_id, EXTRACT(YEAR FROM NEW.start_date)::int, 22, v_total_days)
    ON CONFLICT (organization_id, user_id, year)
    DO UPDATE SET used_days = rh_vacation_balances.used_days + v_total_days, updated_at = now();
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
$function$;
