import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { normalizeString } from "@/lib/utils";

export interface PortalTotalLinkFiltersState {
  period: DateRange | undefined;
  clientQuery: string;
  contractQuery: string;
  sellerQuery: string;
  cycle: string;
  year: string;
  commercialStatus: string;
  boStatus: string;
}

const defaultFilters: PortalTotalLinkFiltersState = {
  period: undefined,
  clientQuery: "",
  contractQuery: "",
  sellerQuery: "",
  cycle: "all",
  year: "all",
  commercialStatus: "all",
  boStatus: "all",
};

interface PortalTotalLinkFiltersContextValue {
  filters: PortalTotalLinkFiltersState;
  setFilter: <K extends keyof PortalTotalLinkFiltersState>(
    key: K,
    value: PortalTotalLinkFiltersState[K],
  ) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const PortalTotalLinkFiltersContext = createContext<PortalTotalLinkFiltersContextValue | null>(null);

const hasTextValue = (value: string) => normalizeString(value).trim().length > 0;

export function PortalTotalLinkFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<PortalTotalLinkFiltersState>(defaultFilters);

  const value = useMemo<PortalTotalLinkFiltersContextValue>(() => {
    const activeFilterCount = [
      filters.period?.from || filters.period?.to ? 1 : 0,
      hasTextValue(filters.clientQuery) ? 1 : 0,
      hasTextValue(filters.contractQuery) ? 1 : 0,
      hasTextValue(filters.sellerQuery) ? 1 : 0,
      filters.cycle !== "all" ? 1 : 0,
      filters.year !== "all" ? 1 : 0,
      filters.commercialStatus !== "all" ? 1 : 0,
      filters.boStatus !== "all" ? 1 : 0,
    ].reduce((sum, item) => sum + item, 0);

    return {
      filters,
      setFilter: (key, value) => {
        setFilters((current) => ({
          ...current,
          [key]: value,
        }));
      },
      resetFilters: () => setFilters(defaultFilters),
      activeFilterCount,
    };
  }, [filters]);

  return <PortalTotalLinkFiltersContext.Provider value={value}>{children}</PortalTotalLinkFiltersContext.Provider>;
}

export function usePortalTotalLinkFilters() {
  const context = useContext(PortalTotalLinkFiltersContext);

  if (!context) {
    throw new Error("usePortalTotalLinkFilters must be used inside PortalTotalLinkFiltersProvider");
  }

  return context;
}
