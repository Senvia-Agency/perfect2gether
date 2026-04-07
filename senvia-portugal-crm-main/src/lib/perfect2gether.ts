export const PERFECT2GETHER_ORG_ID = "96a3950e-31be-4c6d-abed-b82968c0d7e9";

interface OrganizationMembershipLike {
  organization_id: string;
  is_active?: boolean;
}

export function isPerfect2GetherOrg(organizationId?: string | null) {
  return organizationId === PERFECT2GETHER_ORG_ID;
}

export function hasPerfect2GetherAccess({
  organizationId,
  memberships = [],
  isSuperAdmin = false,
}: {
  organizationId?: string | null;
  memberships?: OrganizationMembershipLike[];
  isSuperAdmin?: boolean;
}) {
  if (!isPerfect2GetherOrg(organizationId)) return false;
  if (isSuperAdmin) return true;

  return memberships.some(
    (membership) => membership.organization_id === PERFECT2GETHER_ORG_ID && membership.is_active !== false
  );
}
