import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccountLoading } from './AccountLoading';
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useMfaCheckpoint } from './MfaCheckpoint';
import { OrganizationSelector } from "./OrganizationSelector";
import { AccountLoadError } from './AccountLoadError';

/**
 * Authentication gate for the Total Link operational portal. It deliberately
 * does not render AppLayout: P2G and Total Link need independent dashboards.
 */
export function TotalLinkProtectedRoute() {
  const {
    user,
    isLoading,
    userDataError,
    retryUserData,
    needsOrgSelection,
    organizations,
    selectOrganization,
    organization,
  } = useAuth();
  const { isLoadingPermissions, hasSystem } = usePermissions();
  const location = useLocation();
  const mfaCheckpoint = useMfaCheckpoint();

  if (isLoading) {
    return <AccountLoading totalLink />;
  }

  if (!user) {
    return <Navigate to="/total-link/login" state={{ from: location }} replace />;
  }

  if (mfaCheckpoint) return mfaCheckpoint;

  if (userDataError) {
    return <AccountLoadError retry={retryUserData} failed />;
  }

  if (needsOrgSelection && organizations.length > 1) {
    return <OrganizationSelector organizations={organizations} onSelect={selectOrganization} />;
  }

  if (!organization) {
    return <AccountLoadError retry={retryUserData} failed={false} />;
  }

  if (isLoadingPermissions) {
    return <AccountLoading totalLink />;
  }

  if (!hasSystem('total_link')) {
    return hasSystem('p2g')
      ? <Navigate to="/dashboard" replace />
      : <div className="total-link-shell flex min-h-screen items-center justify-center p-6 text-center">Esta conta não tem acesso ao Total Link.</div>;
  }

  return <Outlet />;
}
