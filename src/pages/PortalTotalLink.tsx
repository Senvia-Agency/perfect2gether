import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PortalTotalLinkFiltersProvider } from "@/components/portal-total-link/PortalTotalLinkContext";
import { PortalTotalLinkLayout } from "@/components/portal-total-link/PortalTotalLinkLayout";
import { useAuth } from "@/contexts/AuthContext";
import { hasPerfect2GetherAccess } from "@/lib/perfect2gether";
import "@/styles/total-link.css";

export default function PortalTotalLink() {
  const { organization, organizations, isSuperAdmin } = useAuth();

  const hasAccess = hasPerfect2GetherAccess({
    organizationId: organization?.id,
    memberships: organizations,
    isSuperAdmin,
  });

  if (!hasAccess) {
    return (
      <div className="total-link-shell flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-[28px] border border-[#d8e4f5] bg-white p-8 text-center shadow-[0_18px_50px_rgba(18,62,175,0.1)]">
          <img src="/total-link-logo.png" alt="Total Link" className="mx-auto h-20 w-44 object-contain" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#122033]">Acesso indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-[#62718a]">Esta conta não tem acesso ativo à área operacional Total Link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="total-link-shell total-link-portal min-h-screen">
      <Helmet>
        <title>Total Link | Área operacional</title>
        <meta name="theme-color" content="#1746ae" />
      </Helmet>
      <PortalTotalLinkFiltersProvider>
        <PortalTotalLinkLayout>
          <Outlet />
        </PortalTotalLinkLayout>
      </PortalTotalLinkFiltersProvider>
    </div>
  );
}
