CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO public.organizations (id, name, slug, plan, niche)
VALUES
  ('96a3950e-31be-4c6d-abed-b82968c0d7e9', 'P2G Local Norte', 'p2g-local-org-a', 'pro', 'telecom'),
  ('00000000-0000-0000-0000-000000001002', 'P2G Local Sul', 'p2g-local-org-b', 'pro', 'telecom')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, plan = EXCLUDED.plan, niche = EXCLUDED.niche;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002001', 'authenticated', 'authenticated', 'admin@p2g.local', extensions.crypt('P2gLocal!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Admin P2G Local"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002002', 'authenticated', 'authenticated', 'bo@p2g.local', extensions.crypt('P2gLocal!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Back Office P2G Local"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002003', 'authenticated', 'authenticated', 'comercial.a@p2g.local', extensions.crypt('P2gLocal!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Comercial A P2G Local"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002004', 'authenticated', 'authenticated', 'comercial.b@p2g.local', extensions.crypt('P2gLocal!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Comercial B P2G Local"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000002005', 'authenticated', 'authenticated', 'comercial.c@p2g.local', extensions.crypt('P2gLocal!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Comercial C P2G Local"}'::jsonb, now(), now())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = EXCLUDED.email_confirmed_at, raw_user_meta_data = EXCLUDED.raw_user_meta_data, updated_at = now();

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider)
SELECT u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email'
FROM auth.users u
WHERE u.email IN ('admin@p2g.local', 'bo@p2g.local', 'comercial.a@p2g.local', 'comercial.b@p2g.local', 'comercial.c@p2g.local')
ON CONFLICT (provider_id, provider) DO UPDATE SET identity_data = EXCLUDED.identity_data, updated_at = now();

UPDATE public.profiles
SET organization_id = CASE id
  WHEN '00000000-0000-0000-0000-000000002001'::uuid THEN '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  WHEN '00000000-0000-0000-0000-000000002002'::uuid THEN '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  WHEN '00000000-0000-0000-0000-000000002003'::uuid THEN '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  WHEN '00000000-0000-0000-0000-000000002004'::uuid THEN '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  WHEN '00000000-0000-0000-0000-000000002005'::uuid THEN '00000000-0000-0000-0000-000000001002'::uuid
  WHEN '00000000-0000-0000-0000-000000002004'::uuid THEN '00000000-0000-0000-0000-000000001002'::uuid
END,
full_name = CASE id
  WHEN '00000000-0000-0000-0000-000000002001'::uuid THEN 'Admin P2G Local'
  WHEN '00000000-0000-0000-0000-000000002002'::uuid THEN 'Back Office P2G Local'
  WHEN '00000000-0000-0000-0000-000000002003'::uuid THEN 'Comercial A P2G Local'
  WHEN '00000000-0000-0000-0000-000000002004'::uuid THEN 'Comercial B P2G Local'
  WHEN '00000000-0000-0000-0000-000000002005'::uuid THEN 'Comercial C P2G Local'
END
WHERE id IN (
  '00000000-0000-0000-0000-000000002001'::uuid,
  '00000000-0000-0000-0000-000000002002'::uuid,
  '00000000-0000-0000-0000-000000002003'::uuid,
  '00000000-0000-0000-0000-000000002004'::uuid,
  '00000000-0000-0000-0000-000000002005'::uuid
);

INSERT INTO public.organization_profiles (organization_id, name, base_role, module_permissions, is_default, data_scope, systems)
SELECT o.id, 'Back Office', 'viewer', admin_profile.module_permissions, false, 'all', ARRAY['p2g']::text[]
FROM public.organizations o
JOIN public.organization_profiles admin_profile
  ON admin_profile.organization_id = o.id
  AND admin_profile.name = 'Administrador'
WHERE o.id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_profiles existing
    WHERE existing.organization_id = o.id
      AND existing.name = 'Back Office'
  );

INSERT INTO public.organization_profiles (organization_id, name, base_role, module_permissions, is_default, data_scope, systems)
SELECT o.id, 'Comercial', salesperson_profile.base_role, salesperson_profile.module_permissions, false, 'own', ARRAY['p2g']::text[]
FROM public.organizations o
JOIN public.organization_profiles salesperson_profile
  ON salesperson_profile.organization_id = o.id
  AND salesperson_profile.name = 'Vendedor'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organization_profiles existing
  WHERE existing.organization_id = o.id
    AND existing.name = 'Comercial'
  );

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000002001', 'super_admin'),
  ('00000000-0000-0000-0000-000000002002', 'viewer'),
  ('00000000-0000-0000-0000-000000002003', 'salesperson'),
  ('00000000-0000-0000-0000-000000002004', 'salesperson'),
  ('00000000-0000-0000-0000-000000002005', 'salesperson')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.organization_members (user_id, organization_id, role, is_active)
VALUES
  ('00000000-0000-0000-0000-000000002001', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'admin', true),
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000001002', 'admin', true),
  ('00000000-0000-0000-0000-000000002002', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'viewer', true),
  ('00000000-0000-0000-0000-000000002003', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'salesperson', true),
  ('00000000-0000-0000-0000-000000002004', '96a3950e-31be-4c6d-abed-b82968c0d7e9', 'salesperson', true),
  ('00000000-0000-0000-0000-000000002005', '00000000-0000-0000-0000-000000001002', 'salesperson', true)
ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

UPDATE public.organization_members member
SET profile_id = profile.id
FROM public.organization_profiles profile
WHERE profile.organization_id = member.organization_id
  AND profile.name = CASE
    WHEN member.user_id = '00000000-0000-0000-0000-000000002002'::uuid THEN 'Back Office'
    WHEN member.user_id IN (
      '00000000-0000-0000-0000-000000002003'::uuid,
      '00000000-0000-0000-0000-000000002004'::uuid,
      '00000000-0000-0000-0000-000000002005'::uuid
    ) THEN 'Comercial'
    ELSE NULL
  END;
