-- Create table for push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users manage own subscriptions"
ON public.push_subscriptions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Super admin full access
CREATE POLICY "Super admin full access push_subscriptions"
ON public.push_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create index for faster lookups by organization
CREATE INDEX idx_push_subscriptions_org ON public.push_subscriptions(organization_id);