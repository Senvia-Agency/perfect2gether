import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export class RequestAccessError extends Error {
  constructor(readonly status: 400 | 401 | 403, message: string) {
    super(message)
    this.name = 'RequestAccessError'
  }
}

export async function requireUser(client: SupabaseClient, req: Request): Promise<string> {
  const bearer = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)
  if (!bearer?.[1]) throw new RequestAccessError(401, 'Não autorizado')
  const { data: { user }, error } = await client.auth.getUser(bearer[1])
  if (error || !user) throw new RequestAccessError(401, 'Não autorizado')
  return user.id
}

type OrganizationAccess = {
  readonly userId: string
  readonly organizationId: unknown
}

export async function requireOrganizationMember(client: SupabaseClient, access: OrganizationAccess): Promise<string | null> {
  if (typeof access.organizationId !== 'string' || !access.organizationId.trim()) {
    throw new RequestAccessError(400, 'Organização é obrigatória')
  }
  const { data: member, error } = await client
    .from('organization_members')
    .select('profile_id')
    .eq('user_id', access.userId)
    .eq('organization_id', access.organizationId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new RequestAccessError(403, 'Sem acesso a esta organização')
  if (member) return typeof member.profile_id === 'string' ? member.profile_id : null
  const { data: superAdmin, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', access.userId)
    .eq('role', 'super_admin')
    .maybeSingle()
  if (roleError || !superAdmin) throw new RequestAccessError(403, 'Sem acesso a esta organização')
  return null
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canEditSettings(permissions: unknown, isAdmin: boolean): boolean {
  if (!isRecord(permissions)) return isAdmin
  const firstKey = Object.keys(permissions)[0]
  const firstModule = firstKey ? permissions[firstKey] : undefined
  const settings = permissions.settings
  // Match the legacy-to-granular conversion used by usePermissions.
  if (isRecord(firstModule) && 'view' in firstModule && !('subareas' in firstModule)) {
    return isRecord(settings) && settings.edit === true
  }
  if (!isRecord(settings) || !isRecord(settings.subareas)) return isAdmin
  const general = settings.subareas.general
  if (!isRecord(general) || general.edit == null) return isAdmin
  return general.edit === true
}

export async function requireIntegrationSettings(
  client: SupabaseClient,
  access: OrganizationAccess & { readonly profileId: string | null },
): Promise<void> {
  const { data: roles, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', access.userId)
  if (roleError || !roles) throw new RequestAccessError(403, 'Sem acesso às integrações')
  // The UI derives these roles from user_roles after selecting the active organization.
  if (roles.some((role: { readonly role: string }) => role.role === 'super_admin')) return
  const isAdmin = roles.some((role: { readonly role: string }) => role.role === 'admin')
  let permissions: unknown = null
  if (access.profileId) {
    const { data: profile, error } = await client
      .from('organization_profiles')
      .select('module_permissions')
      .eq('id', access.profileId)
      .eq('organization_id', access.organizationId)
      .maybeSingle()
    if (error || !profile) throw new RequestAccessError(403, 'Sem acesso às integrações')
    permissions = profile.module_permissions
  }
  if (!canEditSettings(permissions, isAdmin)) throw new RequestAccessError(403, 'Sem acesso às integrações')
}
