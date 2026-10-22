import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MjCompanyData } from "@/lib/prospects/mj-metadata";
import { MjCompanyDetails } from "./MjCompanyDetails";

export function MjCompanyPopover({ companyName, data }: { companyName: string; data: MjCompanyData }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" aria-label={`Ver dados da empresa ${companyName}`}>
          <Info className="h-3.5 w-3.5" />
          Dados
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto">
        <p className="mb-3 font-semibold">{companyName}</p>
        <MjCompanyDetails data={data} />
      </PopoverContent>
    </Popover>
  );
}
