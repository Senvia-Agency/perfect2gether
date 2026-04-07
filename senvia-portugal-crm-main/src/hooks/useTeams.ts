import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  leader_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberEntry {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export function useTeams() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['teams', organization?.id],
    queryFn: async (): Promise<Team[]> => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Team[];
    },
    enabled: !!organization?.id,
  });
}

export function useTeamMembersForTeam(teamId: string | null) {
  return useQuery({
    queryKey: ['team-members-entries', teamId],
    queryFn: async (): Promise<TeamMemberEntry[]> => {
      if (!teamId) return [];

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;
      return (data || []) as TeamMemberEntry[];
    },
    enabled: !!teamId,
  });
}

export function useAllTeamMembersEntries() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['all-team-members-entries', organization?.id],
    queryFn: async (): Promise<TeamMemberEntry[]> => {
      if (!organization?.id) return [];

      // Get all teams for this org first
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('organization_id', organization.id);

      if (teamsError) throw teamsError;
      if (!teams || teams.length === 0) return [];

      const teamIds = teams.map(t => t.id);
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .in('team_id', teamIds);

      if (error) throw error;
      return (data || []) as TeamMemberEntry[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, leader_id }: { name: string; leader_id: string }) => {
      if (!organization?.id) throw new Error('Sem organização');

      const { data, error } = await supabase
        .from('teams')
        .insert({ organization_id: organization.id, name, leader_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Equipa criada', description: 'A equipa foi criada com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível criar a equipa.', variant: 'destructive' });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ teamId, name, leader_id }: { teamId: string; name: string; leader_id: string }) => {
      const { error } = await supabase
        .from('teams')
        .update({ name, leader_id })
        .eq('id', teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Equipa atualizada' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar a equipa.', variant: 'destructive' });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['all-team-members-entries'] });
      toast({ title: 'Equipa eliminada' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível eliminar a equipa.', variant: 'destructive' });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-team-members-entries'] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-team-members-entries'] });
    },
  });
}

export function useSetTeamMembers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ teamId, memberUserIds }: { teamId: string; memberUserIds: string[] }) => {
      // Delete all existing members
      const { error: delError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId);
      if (delError) throw delError;

      // Insert new members
      if (memberUserIds.length > 0) {
        const { error: insError } = await supabase
          .from('team_members')
          .insert(memberUserIds.map(uid => ({ team_id: teamId, user_id: uid })));
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-team-members-entries'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Colaboradores atualizados' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar os colaboradores.', variant: 'destructive' });
    },
  });
}
