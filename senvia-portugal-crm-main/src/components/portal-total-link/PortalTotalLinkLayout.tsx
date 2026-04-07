import { type ReactNode, useState } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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

  const updateHomeParam = (key: "homeCycle" | "homeYear", value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(key, value);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6 p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
      <section className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Portal Total Link</h1>
              {currentSection.description ? (
                <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{currentSection.description}</p>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Select value={selectedCycle} onValueChange={(value) => updateHomeParam("homeCycle", value)}>
                  <SelectTrigger className="h-9 w-[120px] text-sm">
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
                <span className="text-muted-foreground/50">·</span>
                <Select value={selectedYear} onValueChange={(value) => updateHomeParam("homeYear", value)}>
                  <SelectTrigger className="h-9 w-[90px] text-sm">
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
              {currentSection.action ? (
                <Button
                  type="button"
                  size="sm"
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
            <nav className="flex min-w-max gap-2 rounded-2xl border border-border bg-muted/30 p-1.5">
              {portalTotalLinkSections.map((section) => (
                <NavLink
                  key={section.key}
                  to={section.path}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )
                  }
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
