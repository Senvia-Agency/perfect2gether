import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PortalTotalLinkRevisaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tipoReceitaOptions = [
  { value: "energia", label: "Energia" },
  { value: "gas", label: "Gás" },
  { value: "dual", label: "Dual" },
  { value: "solar", label: "Solar" },
];

export function PortalTotalLinkRevisaoDialog({
  open,
  onOpenChange,
}: PortalTotalLinkRevisaoDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clienteNif: "",
    nCaso: "",
    prazo: "",
    registo: "",
    mensalPretendida: "",
    tipoReceita: "",
    penalizacaoTipoReceita: "",
    multiplo: "",
  });

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setFormData({
        clienteNif: "",
        nCaso: "",
        prazo: "",
        registo: "",
        mensalPretendida: "",
        tipoReceita: "",
        penalizacaoTipoReceita: "",
        multiplo: "",
      });
      setFileName(null);
    }
    onOpenChange(value);
  };

  const updateField = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent variant="fullScreen">
        <DialogHeader>
          <DialogTitle>Nova Revisão de Proposta</DialogTitle>
          <DialogDescription>Revisão de Propostas</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Cliente NIF
            </Label>
            <Input
              placeholder="Introduza o NIF"
              value={formData.clienteNif}
              onChange={(e) => updateField("clienteNif", e.target.value)}
            />

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Nº Caso
            </Label>
            <Input
              placeholder="Número do caso"
              value={formData.nCaso}
              onChange={(e) => updateField("nCaso", e.target.value)}
            />

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Prazo
            </Label>
            <Input
              placeholder="Prazo"
              value={formData.prazo}
              onChange={(e) => updateField("prazo", e.target.value)}
            />

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Registo
            </Label>
            <Input
              placeholder="Registo"
              value={formData.registo}
              onChange={(e) => updateField("registo", e.target.value)}
            />

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Mensal. Pretendida
            </Label>
            <Input
              placeholder="Mensalidade pretendida"
              value={formData.mensalPretendida}
              onChange={(e) => updateField("mensalPretendida", e.target.value)}
            />

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Tipo Receita
            </Label>
            <Select
              value={formData.tipoReceita}
              onValueChange={(v) => updateField("tipoReceita", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipoReceitaOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Penalização Tipo Receita
            </Label>
            <Input
              placeholder="Penalização"
              value={formData.penalizacaoTipoReceita}
              onChange={(e) => updateField("penalizacaoTipoReceita", e.target.value)}
            />

            <Label className="flex items-center text-sm font-medium sm:justify-end">
              Múltiplo
            </Label>
            <Input
              placeholder="Múltiplo"
              value={formData.multiplo}
              onChange={(e) => updateField("multiplo", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0"
            >
              <Upload className="h-4 w-4" />
              Escolher ficheiro
            </Button>
            <span className="text-sm text-muted-foreground">
              {fileName ?? "Nenhum ficheiro selecionado"}
            </span>
            <Button type="button" variant="secondary" className="shrink-0 sm:ml-auto">
              Gravar
            </Button>
          </div>

          <Button type="button" className="w-full">
            Adicionar Nova Revisão de Proposta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
