import { type ReactNode, useState } from "react";
import { Link, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { PortalTotalLinkFilters } from "./PortalTotalLinkFilters";
import { PortalTotalLinkReclamacaoAddDialog } from "./PortalTotalLinkReclamacaoAddDialog";
import { PortalTotalLinkContratoAddDialog } from "./PortalTotalLinkContratoAddDialog";
import { PortalTotalLinkRevisaoDialog } from "./PortalTotalLinkRevisaoDialog";
import {
  portalTotalLinkHomeCycleOptions,
  portalTotalLinkHomeYearOptions,
  portalTotalLinkSections,
} from "./portalTotalLinkConfig";

export function PortalTotalLinkLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isReclamacaoDialogOpen, setIsReclamacaoDialogOpen] = useState(false);
  const [isContratoDialogOpen, setIsContratoDialogOpen] = useState(false);
  const [isRevisaoDialogOpen, setIsRevisaoDialogOpen] = useState(false);

  const currentSection =
    portalTotalLinkSections.find(
      (section) => location.pathname === section.path || location.pathname.startsWith(`${section.path}/`),
    ) ?? portalTotalLinkSections[0];

  const isHomeSection = currentSection.key === "home";
  const selectedCycle = searchParams.get("homeCycle") ?? portalTotalLinkHomeCycleOptions[0]?.value ?? "1";
  const selectedYear = searchParams.get("homeYear") ?? portalTotalLinkHomeYearOptions[2]?.value ?? String(new Date().getFullYear());
  const ActionIcon = currentSection.action?.icon;

  const { can } = usePermissions();
  // Gate the header action button per section. The "pendentes" action is a read-only
  // search trigger (no-op here), so it is not permission-gated.
  // Contratos has no dedicated 'add' permission action; gate it on 'edit'.
  const canSectionAction =
    currentSection.key === "contratos" ? can('portal_total_link', 'contratos', 'edit')
    : currentSection.key === "ids" ? can('portal_total_link', 'ids', 'edit')
    : currentSection.key === "reclamacoes" ? can('portal_total_link', 'reclamacoes', 'add')
    : true;

  const updateHomeParam = (key: "homeCycle" | "homeYear", value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(key, value);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <section className="space-y-4">
        <div className="overflow-hidden rounded-[28px] border border-[#d8e4f5] bg-white p-4 shadow-[0_12px_36px_rgba(18,62,175,0.07)] md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <img src="/total-link-logo.png" alt="Total Link" className="h-14 w-28 shrink-0 object-contain object-left sm:h-16 sm:w-32" />
              <div className="space-y-1 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2473da]">Área operacional</p>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#122033] md:text-3xl">{currentSection.title}</h1>
              {currentSection.description ? (
                <p className="max-w-3xl text-sm text-[#62718a] md:text-base">{currentSection.description}</p>
              ) : null}
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Link to="/dashboard" className="text-xs font-semibold text-[#315994] transition-colors hover:text-[#123eaf]">Ir para Perfect2Gether</Link>
              <div className="flex items-center gap-2">
                <Select value={selectedCycle} onValueChange={(value) => updateHomeParam("homeCycle", value)}>
                  <SelectTrigger className="h-9 w-[120px] border-[#d5e1f1] text-sm text-[#243552]">
                    <SelectValue placeholder="Ciclo" />
                  </SelectTrigger>
                  <SelectContent>
                    {portalTotalLinkHomeCycleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[#9aa8bb]">·</span>
                <Select value={selectedYear} onValueChange={(value) => updateHomeParam("homeYear", value)}>
                  <SelectTrigger className="h-9 w-[90px] border-[#d5e1f1] text-sm text-[#243552]">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {portalTotalLinkHomeYearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentSection.action && canSectionAction ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#123eaf] text-white hover:bg-[#103793]"
                  onClick={
                    currentSection.key === "reclamacoes" ? () => setIsReclamacaoDialogOpen(true)
                    : currentSection.key === "contratos" ? () => setIsContratoDialogOpen(true)
                    : currentSection.key === "ids" ? () => setIsRevisaoDialogOpen(true)
                    : undefined
                  }
                >
                  {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
                  {currentSection.action.label}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <nav className="flex min-w-max gap-2 rounded-2xl border border-[#d8e4f5] bg-[#f5f9ff] p-1.5">
              {portalTotalLinkSections.map((section) => (
                <NavLink
                  key={section.key}
                  to={section.path}
                  className={({ isActive }) => cn("total-link-tab inline-flex h-11 items-center justify-center rounded-xl border border-transparent px-4 text-sm font-semibold text-[#62718a] transition-colors hover:bg-white hover:text-[#123eaf]", isActive && "text-white")}
                  data-active={location.pathname === section.path || location.pathname.startsWith(`${section.path}/`)}
                >
                  {section.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {!isHomeSection && (
          <PortalTotalLinkFilters />
        )}
      </section>

      {children}

      <PortalTotalLinkReclamacaoAddDialog
        open={isReclamacaoDialogOpen}
        onOpenChange={setIsReclamacaoDialogOpen}
      />
      <PortalTotalLinkContratoAddDialog
        open={isContratoDialogOpen}
        onOpenChange={setIsContratoDialogOpen}
      />
      <PortalTotalLinkRevisaoDialog
        open={isRevisaoDialogOpen}
        onOpenChange={setIsRevisaoDialogOpen}
      />
    </div>
  );
}
