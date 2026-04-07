
-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  max_users integer,
  max_forms integer,
  price_monthly numeric NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

-- Insert the 3 plans
INSERT INTO public.subscription_plans (id, name, max_users, max_forms, price_monthly, features) VALUES
('starter', 'Starter', 10, 2, 49, '{"modules":{"sales":false,"finance":false,"marketing":false,"ecommerce":false},"integrations":{"whatsapp":false,"invoicing":false,"meta_pixels":false},"features":{"conversational_forms":false,"multi_org":false,"push_notifications":false,"fidelization_alerts":false}}'::jsonb),
('pro', 'Pro', 25, 10, 99, '{"modules":{"sales":true,"finance":false,"marketing":true,"ecommerce":false},"integrations":{"whatsapp":true,"invoicing":false,"meta_pixels":true},"features":{"conversational_forms":true,"multi_org":false,"push_notifications":true,"fidelization_alerts":false}}'::jsonb),
('elite', 'Elite', NULL, NULL, 199, '{"modules":{"sales":true,"finance":true,"marketing":true,"ecommerce":true},"integrations":{"whatsapp":true,"invoicing":true,"meta_pixels":true},"features":{"conversational_forms":true,"multi_org":true,"push_notifications":true,"fidelization_alerts":true}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET features = EXCLUDED.features, max_users = EXCLUDED.max_users, max_forms = EXCLUDED.max_forms, price_monthly = EXCLUDED.price_monthly;
