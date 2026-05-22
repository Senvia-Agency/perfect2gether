-- Sync auth.users.email to match profiles.email for all users where they differ.
-- Source of truth is profiles.email (what appears in the UI).
-- Only updates where there is no conflict (another auth user already has that email).

-- Preview what will change:
-- SELECT u.id, u.email AS auth_email, p.email AS profile_email, p.full_name
-- FROM auth.users u
-- JOIN public.profiles p ON p.id = u.id
-- WHERE u.email IS DISTINCT FROM p.email
-- ORDER BY p.full_name;

UPDATE auth.users u
SET
  email                = p.email,
  email_confirmed_at   = COALESCE(u.email_confirmed_at, NOW()),
  updated_at           = NOW()
FROM public.profiles p
WHERE u.id = p.id
  AND u.email IS DISTINCT FROM p.email
  -- Skip if the target email is already taken by a different auth user
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u2
    WHERE lower(u2.email) = lower(p.email)
      AND u2.id != u.id
  );
