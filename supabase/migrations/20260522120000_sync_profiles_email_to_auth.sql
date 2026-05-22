-- Make profiles.email the enforced source of truth.
-- When profiles.email is updated, automatically propagate to:
--   - auth.users.email (login email)
--   - auth.users.email_confirmed_at (ensure confirmed)
--   - auth.identities.identity_data->>'email' (for 'email' provider rows)
--
-- This prevents future drift between what the UI shows (profiles.email)
-- and what the user actually logs in with (auth.users.email).

CREATE OR REPLACE FUNCTION public.sync_profile_email_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only act when email actually changes
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    -- Update auth.users
    UPDATE auth.users
    SET
      email              = LOWER(TRIM(NEW.email)),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at         = NOW()
    WHERE id = NEW.id
      AND email IS DISTINCT FROM LOWER(TRIM(NEW.email));

    -- Update auth.identities (provider = 'email')
    UPDATE auth.identities
    SET
      identity_data = jsonb_set(
        COALESCE(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(LOWER(TRIM(NEW.email)))
      ),
      updated_at = NOW()
    WHERE user_id = NEW.id
      AND provider = 'email';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_email_to_auth_trigger ON public.profiles;

CREATE TRIGGER sync_profile_email_to_auth_trigger
AFTER UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_to_auth();

COMMENT ON FUNCTION public.sync_profile_email_to_auth() IS
  'Keeps auth.users.email and auth.identities in sync with profiles.email. profiles.email is the source of truth (UI-driven).';
