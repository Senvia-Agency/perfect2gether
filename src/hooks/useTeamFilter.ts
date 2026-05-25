import { create } from 'zustand';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeams, useAllTeamMembersEntries } from '@/hooks/useTeams';
import { useTeamMembers } from '@/hooks/useTeam';
import { useEffect, useMemo } from 'react';

interface TeamFilterStore {
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
}

// Estado global para o filtro de equipa (admin)
export const useTeamFilterStore = create<TeamFilterStore>((set) => ({
  selectedMemberId: null,
  setSelectedMemberId: (id) => set({ selectedMemberId: id }),
}));

export function useTeamFilter() {
  const { user } = useAuth();
  const { dataScope } = usePermissions();
  const { selectedMemberId, setSelectedMemberId } = useTeamFilterStore();
  const { data: teams = [] } = useTeams();
  const { data: allEntries = [] } = useAllTeamMembersEntries();
  const { data: organizationMembers = [] } = useTeamMembers();

  const canSeeAll = dataScope === 'all';
  const canSeeTeam = dataScope === 'team';

  const ledTeam = useMemo(() => {
    if (!user?.id) return null;
    return teams.find(t => t.leader_id === user.id) || null;
  }, [teams, user?.id]);

  const isTeamLeader = !!ledTeam;

  const teamMemberIds = useMemo(() => {
    if (!ledTeam) return [];
    return allEntries.filter(e => e.team_id === ledTeam.id).map(e => e.user_id);
  }, [ledTeam, allEntries]);

  const allowedSelectionIds = useMemo(() => {
    if (canSeeAll) {
      return new Set(
        organizationMembers
          .map((member) => member.user_id)
          .concat(user?.id ? [user.id] : [])
      );
    }

    if (canSeeTeam && isTeamLeader) {
      return new Set([user?.id, ...teamMemberIds].filter(Boolean) as string[]);
    }

    return new Set(user?.id ? [user.id] : []);
  }, [organizationMembers, canSeeAll, canSeeTeam, isTeamLeader, teamMemberIds, user?.id]);

  useEffect(() => {
    if (!selectedMemberId) return;
    if (!allowedSelectionIds.has(selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [allowedSelectionIds, selectedMemberId, setSelectedMemberId]);

  const effectiveUserIds: string[] | null = useMemo(() => {
    if (canSeeAll) {
      return selectedMemberId ? [selectedMemberId] : null;
    }

    if (canSeeTeam && isTeamLeader && user?.id) {
      if (selectedMemberId) return [selectedMemberId];
      return [user.id, ...teamMemberIds];
    }

    return user?.id ? [user.id] : null;
  }, [canSeeAll, canSeeTeam, isTeamLeader, selectedMemberId, user?.id, teamMemberIds]);

  const effectiveUserId = canSeeAll
    ? selectedMemberId
    : (canSeeTeam && isTeamLeader)
      ? selectedMemberId || null
      : user?.id || null;

  const canFilterByTeam = canSeeAll || (canSeeTeam && isTeamLeader);

  return {
    effectiveUserId,
    effectiveUserIds,
    selectedMemberId,
    setSelectedMemberId,
    canFilterByTeam,
    isFilteringAll: canSeeAll && !selectedMemberId,
    isTeamLeader,
    ledTeam,
    teamMemberIds,
    currentUserId: user?.id,
    dataScope,
  };
}

/**
 * Restringe uma lista de membros ao escopo do utilizador e devolve o rótulo
 * da opção "todos". FONTE ÚNICA para qualquer filtro de colaborador na app
 * (Dashboard, Clientes, Agenda):
 *  - apenas produtores: exclui admins, super_admins e observadores cujo
 *    perfil tem data_scope='all' (ex.: Diretor Comercial), pois nenhum
 *    destes "produz" leads/clientes/vendas;
 *  - líder de equipa   -> apenas a sua equipa  ("Minha equipa")
 *  - admin / restantes -> lista completa       ("Todos os colaboradores")
 */
type ScopableMember = { user_id: string; role?: string | null; profile_data_scope?: string | null };

export function useTeamScopedMembers<T extends ScopableMember>(allMembers: T[]) {
  const { canFilterByTeam, isTeamLeader, teamMemberIds, currentUserId } = useTeamFilter();
  const members = useMemo(() => {
    const producers = allMembers.filter(m =>
      m.role !== 'admin' &&
      m.role !== 'super_admin' &&
      m.profile_data_scope !== 'all'
    );
    if (!isTeamLeader) return producers;
    const allowed = new Set([currentUserId, ...teamMemberIds].filter(Boolean) as string[]);
    return producers.filter(m => allowed.has(m.user_id));
  }, [allMembers, isTeamLeader, teamMemberIds, currentUserId]);
  return {
    members,
    canFilterByTeam,
    isTeamLeader,
    allOptionLabel: isTeamLeader ? 'Minha equipa' : 'Todos os colaboradores',
  };
}
