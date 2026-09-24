import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ChallengeMFA } from "./ChallengeMFA";
import { OrganizationSelector } from "./OrganizationSelector";

/**
 * Authentication gate for the Total Link operational portal. It deliberately
 * does not render AppLayout: P2G and Total Link need independent dashboards.
 */
export function TotalLinkProtectedRoute() {
  const {
    user,
    isLoading,
    needsOrgSelection,
    organizations,
    selectOrganization,
    mfaStatus,
    completeMfaChallenge,
  } = useAuth();
  const { isLoadingPermissions, hasSystem } = usePermissions();
  const location = useLocation();

  if (isLoading || isLoadingPermissions) {
    return (
      <div className="total-link-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1659c9]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/total-link/login" state={{ from: location }} replace />;
  }

  if (!hasSystem('total_link')) {
    return hasSystem('p2g')
      ? <Navigate to="/dashboard" replace />
      : <div className="total-link-shell flex min-h-screen items-center justify-center p-6 text-center">Esta conta não tem acesso ao Total Link.</div>;
  }

  if (mfaStatus === "pending") {
    return <ChallengeMFA onSuccess={completeMfaChallenge} />;
  }

  if (needsOrgSelection && organizations.length > 1) {
    return <OrganizationSelector organizations={organizations} onSelect={selectOrganization} />;
  }

  return <Outlet />;
}
