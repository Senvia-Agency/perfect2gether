
-- Create teams table
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  leader_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS for teams: org members can read
CREATE POLICY "Members view org teams"
  ON public.teams FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- Admins can manage teams
CREATE POLICY "Admins manage org teams"
  ON public.teams FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Super admin full access teams
CREATE POLICY "Super admin full access teams"
  ON public.teams FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS for team_members: org members can read via join
CREATE POLICY "Members view org team_members"
  ON public.team_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.organization_id = get_user_org_id(auth.uid())
  ));

-- Admins can manage team members
CREATE POLICY "Admins manage org team_members"
  ON public.team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  ));

-- Super admin full access team_members
CREATE POLICY "Super admin full access team_members"
  ON public.team_members FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Helper function: get member IDs for a team leader
CREATE OR REPLACE FUNCTION public.get_team_member_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    array_agg(tm.user_id),
    ARRAY[]::uuid[]
  )
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE t.leader_id = p_user_id;
$$;

-- Update timestamp trigger for teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
