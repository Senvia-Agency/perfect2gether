-- Create table for user dashboard widget preferences
CREATE TABLE public.dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id, widget_type)
);

-- Enable RLS
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own widgets
CREATE POLICY "Users manage own dashboard widgets"
  ON public.dashboard_widgets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Super admin full access
CREATE POLICY "Super admin full access dashboard_widgets"
  ON public.dashboard_widgets
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));