export type EdpWorkflowMembership = {
  readonly memberRole: string;
  readonly memberActive: boolean;
  readonly hasProfile: boolean;
  readonly profileName: string | null;
  readonly baseRole: string | null;
};

const WORKFLOW_ROLES = ['admin', 'salesperson'];

/**
 * Espelha public.edp_is_workflow_actor: quem o servidor deixa carregar e arquivar documentos de clientes.
 * Admin/super_admin globais; ou membro ativo com perfil "Back Office" ou papel base admin/comercial;
 * ou, sem perfil atribuído, com papel de membro admin/comercial.
 */
export function isEdpWorkflowActor(isGlobalAdmin: boolean, membership: EdpWorkflowMembership | null): boolean {
  if (isGlobalAdmin) return true;
  if (!membership?.memberActive) return false;
  if (membership.hasProfile) {
    return membership.profileName === 'Back Office' || WORKFLOW_ROLES.includes(membership.baseRole ?? '');
  }
  return WORKFLOW_ROLES.includes(membership.memberRole);
}
