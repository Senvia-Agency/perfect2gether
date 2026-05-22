import { ROLE_LABELS } from '@/types';

/**
 * Entrada para o rótulo de papel. Cobre os dois casos da app:
 *  - utilizador atual: array `roles` (vindo de useAuth().roles);
 *  - outro utilizador / convite / perfil: `role` único.
 */
interface RoleLabelInput {
  /** Nome do perfil de organização (organization_profiles.name). Tem prioridade. */
  profileName?: string | null;
  /** Papel-base único: organization_members.role, user_roles.role, base_role de um perfil ou role de um convite. */
  role?: string | null;
  /** Array de papéis-base do utilizador atual (useAuth().roles). */
  roles?: readonly string[] | null;
}

/**
 * Rótulo de papel para exibição — FONTE ÚNICA DE VERDADE.
 *
 * Todo o lado da app que mostra "o papel de um utilizador" deve usar esta função.
 * Prioridade: super_admin > nome do perfil de organização > papel-base do enum.
 *
 * Não exibir papéis por outra via (ex.: indexar ROLE_LABELS diretamente): foi essa
 * divergência de fontes que fazia um "Diretor Comercial" aparecer como "Comercial".
 */
export function getRoleLabel(input: RoleLabelInput): string {
  const all = input.roles ?? (input.role ? [input.role] : []);
  if (all.includes('super_admin')) return ROLE_LABELS.super_admin;
  if (input.profileName) return input.profileName;
  if (all.includes('admin')) return ROLE_LABELS.admin;
  if (all.includes('viewer')) return ROLE_LABELS.viewer;
  if (all.includes('salesperson')) return ROLE_LABELS.salesperson;
  return 'Colaborador';
}
