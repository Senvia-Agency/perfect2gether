import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mjLocation, type MjCompanyData } from "@/lib/prospects/mj-metadata";
import { MjCompanyDetails } from "./MjCompanyDetails";

interface MjCompanyPopoverProps {
  companyName: string;
  nif?: string | null;
  data: MjCompanyData;
}

export function MjCompanyPopover({ companyName, nif, data }: MjCompanyPopoverProps) {
  const subtitle = [nif ? `NIF ${nif}` : null, mjLocation(data)].filter(Boolean).join(" · ");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" aria-label={`Ver dados da empresa ${companyName}`}>
          <Info className="h-3.5 w-3.5" />
          Dados
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="break-words text-lg">{companyName}</DialogTitle>
          <DialogDescription>{subtitle || "Dados da publicação do MJ"}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto bg-muted/30 p-4 sm:p-6">
          <MjCompanyDetails data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
