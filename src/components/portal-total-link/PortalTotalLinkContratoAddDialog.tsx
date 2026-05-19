import { useState } from "react";
import { Search, User, Loader2, Upload, X, FileText, Plus, Check, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ClientData {
  nif: string;
  nome: string;
  email: string;
  telefone: string;
  codigoCrc: string;
  validadeCrc: string;
}

interface ContratoFormData {
  tipoContrato: string;
  receitaInicial: string;
  periodoPonderadoInicial: string;
  receitaFinal: string;
  periodoPonderadoFinal: string;
  faturaEletronica: string;
  marketingFlag: string;
  portabilidade: string;
  envioEquipamento: string;
  contratoOa: string;
  npc: string;
  familiasInicial: string;
  familiasFinal: string;
  alarmes: string;
  debitoDireto: string;
  marcacoes: string;
  permanenciaFinal30: string;
  central: string;
  wifi: string;
  notas: string;
}

interface IdData {
  subsidiacaoExtra: boolean;
  revisaoPropostas: boolean;
  uaFicticia: boolean;
  oferta1Fatura: boolean;
  reducaoSuperior15: boolean;
  descontosAquisicao: boolean;
  files: File[];
  saved: boolean;
}

const createEmptyId = (): IdData => ({
  subsidiacaoExtra: false,
  revisaoPropostas: false,
  uaFicticia: false,
  oferta1Fatura: false,
  reducaoSuperior15: false,
  descontosAquisicao: false,
  files: [],
  saved: false,
});

const ID_CHECKBOX_FIELDS: { key: keyof Omit<IdData, 'files' | 'saved'>; label: string }[] = [
  { key: "subsidiacaoExtra", label: "Subsidiação Extra" },
  { key: "revisaoPropostas", label: "Revisão de Propostas" },
  { key: "uaFicticia", label: "UA Fictícia" },
  { key: "oferta1Fatura", label: "Oferta 1 Fatura" },
  { key: "reducaoSuperior15", label: "Redução Superior a 15% (downgrade)" },
  { key: "descontosAquisicao", label: "Descontos Aquisição" },
];

// Mock: simula pesquisa no PHC CS
const MOCK_PHC_CLIENTS: Record<string, ClientData & { dataContrato: string; prazoMeses: number; totalReceita: string }> = {
  "123456789": {
    nif: "123456789",
    nome: "João Manuel Silva",
    email: "joao.silva@email.pt",
    telefone: "912345678",
    codigoCrc: "CRC-2024-001234",
    validadeCrc: "2026-12-31",
    dataContrato: "2025-03-15",
    prazoMeses: 24,
    totalReceita: "1.250,00",
  },
  "987654321": {
    nif: "987654321",
    nome: "Maria Santos Ferreira",
    email: "maria.ferreira@empresa.pt",
    telefone: "965432100",
    codigoCrc: "CRC-2024-005678",
    validadeCrc: "2025-09-30",
    dataContrato: "2024-11-20",
    prazoMeses: 12,
    totalReceita: "890,00",
  },
};

interface PortalTotalLinkContratoAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIM_NAO_OPTIONS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const TIPO_CONTRATO_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "existente", label: "Existente" },
  { value: "residencial", label: "Residencial" },
];

function SimNaoSelect({ value, onValueChange, placeholder }: { value: string; onValueChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || "Selecionar"} />
      </SelectTrigger>
      <SelectContent>
        {SIM_NAO_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PortalTotalLinkContratoAddDialog({
  open,
  onOpenChange,
}: PortalTotalLinkContratoAddDialogProps) {
  const [nif, setNif] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [clientData, setClientData] = useState<(typeof MOCK_PHC_CLIENTS)[string] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [atualizarDados, setAtualizarDados] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [quantidadeIds, setQuantidadeIds] = useState("");
  const [ids, setIds] = useState<IdData[]>([]);

  const [form, setForm] = useState<ContratoFormData>({
    tipoContrato: "",
    receitaInicial: "",
    periodoPonderadoInicial: "",
    receitaFinal: "",
    periodoPonderadoFinal: "",
    faturaEletronica: "",
    marketingFlag: "",
    portabilidade: "",
    envioEquipamento: "",
    contratoOa: "",
    npc: "",
    familiasInicial: "",
    familiasFinal: "",
    alarmes: "",
    debitoDireto: "",
    marcacoes: "",
    permanenciaFinal30: "",
    central: "",
    wifi: "",
    notas: "",
  });

  const updateForm = <K extends keyof ContratoFormData>(key: K, value: ContratoFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAddIds = () => {
    const qty = parseInt(quantidadeIds);
    if (!qty || qty < 1 || qty > 10) return;
    setIds(Array.from({ length: qty }, () => createEmptyId()));
  };

  const updateIdCheckbox = (index: number, key: keyof Omit<IdData, 'files' | 'saved'>, value: boolean) => {
    setIds(prev => prev.map((id, i) => {
      if (i !== index) return id;
      // Reset all checkboxes, then set the selected one
      const reset: Partial<IdData> = {};
      for (const field of ID_CHECKBOX_FIELDS) reset[field.key] = false;
      return { ...id, ...reset, [key]: value };
    }));
  };

  const addIdFiles = (index: number, newFiles: FileList) => {
    setIds(prev => prev.map((id, i) => i === index ? { ...id, files: [...id.files, ...Array.from(newFiles)] } : id));
  };

  const removeIdFile = (idIndex: number, fileIndex: number) => {
    setIds(prev => prev.map((id, i) => i === idIndex ? { ...id, files: id.files.filter((_, fi) => fi !== fileIndex) } : id));
  };

  const saveId = (index: number) => {
    setIds(prev => prev.map((id, i) => i === index ? { ...id, saved: true } : id));
    toast.success(`ID ${index + 1} gravado com sucesso!`);
  };

  const handleSearch = async () => {
    if (!nif.trim()) return;
    setIsSearching(true);
    setNotFound(false);
    setClientData(null);

    // Mock: simula latência de chamada ao PHC CS
    await new Promise((resolve) => setTimeout(resolve, 800));

    const normalizedNif = nif.replace(/[\s.-]/g, "");
    const found = MOCK_PHC_CLIENTS[normalizedNif] || null;

    if (found) {
      setClientData(found);
      setNotFound(false);
    } else {
      setClientData(null);
      setNotFound(true);
    }

    setIsSearching(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // Validação dos campos obrigatórios
    const required: (keyof ContratoFormData)[] = [
      "tipoContrato", "receitaInicial", "periodoPonderadoInicial",
      "receitaFinal", "periodoPonderadoFinal", "faturaEletronica",
      "marketingFlag", "portabilidade", "envioEquipamento", "contratoOa",
      "npc", "familiasInicial", "familiasFinal", "debitoDireto",
      "marcacoes", "permanenciaFinal30", "central", "wifi",
    ];

    const missing = required.filter(k => !form[k]);
    if (missing.length > 0 || !clientData) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    // TODO: enviar dados para o backend quando integração PHC CS estiver pronta
    toast.success("Contrato criado com sucesso!");
    handleOpenChange(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setNif("");
      setIsSearching(false);
      setClientData(null);
      setNotFound(false);
      setAtualizarDados(false);
      setFiles([]);
      setQuantidadeIds("");
      setIds([]);
      setForm({
        tipoContrato: "",
        receitaInicial: "",
        periodoPonderadoInicial: "",
        receitaFinal: "",
        periodoPonderadoFinal: "",
        faturaEletronica: "",
        marketingFlag: "",
        portabilidade: "",
        envioEquipamento: "",
        contratoOa: "",
        npc: "",
        familiasInicial: "",
        familiasFinal: "",
        alarmes: "",
        debitoDireto: "",
        marcacoes: "",
        permanenciaFinal30: "",
        central: "",
        wifi: "",
        notas: "",
      });
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent variant="fullScreen">
        <DialogHeader>
          <DialogTitle>Adicionar Contrato</DialogTitle>
          <DialogDescription>
            Pesquise o NIF do cliente no PHC CS para associar um novo contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pb-6 p-4">
          {/* Pesquisa NIF */}
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="Introduza o NIF"
              value={nif}
              onChange={(e) => {
                setNif(e.target.value);
                setNotFound(false);
                setClientData(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={!nif.trim() || isSearching}
              className="shrink-0"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-1" />
              )}
              Pesquisar
            </Button>
          </div>

          {/* NIF não encontrado */}
          {notFound && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/30">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">NIF não encontrado no PHC CS</p>
                  <p className="text-xs text-muted-foreground">
                    Verifique o NIF e tente novamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dados do Cliente (PHC CS) */}
          {clientData && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Dados do Cliente</CardTitle>
                    <Badge variant="secondary" className="text-xs">PHC CS</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">NIF</Label>
                      <Input value={clientData.nif} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Nome</Label>
                      <Input value={clientData.nome} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <Input value={clientData.email} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Telefone</Label>
                      <Input value={clientData.telefone} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Código CRC</Label>
                      <Input
                        value={clientData.codigoCrc}
                        disabled={!atualizarDados}
                        className={!atualizarDados ? "bg-muted/50" : ""}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Data de Validade CRC</Label>
                      <Input
                        type="date"
                        value={clientData.validadeCrc}
                        disabled={!atualizarDados}
                        className={!atualizarDados ? "bg-muted/50" : ""}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="atualizar-dados"
                      checked={atualizarDados}
                      onCheckedChange={(checked) => setAtualizarDados(checked === true)}
                    />
                    <Label htmlFor="atualizar-dados" className="text-sm cursor-pointer">
                      Atualizar dados CRC
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Dados do Contrato */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dados do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Data do Contrato (PHC) */}
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Data do Contrato</Label>
                      <Input type="date" value={clientData.dataContrato} disabled className="bg-muted/50" />
                    </div>

                    {/* Tipo de Contrato */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo de Contrato <span className="text-destructive">*</span></Label>
                      <Select value={form.tipoContrato} onValueChange={v => updateForm("tipoContrato", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_CONTRATO_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Receita Inicial */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Receita Inicial <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={form.receitaInicial}
                        onChange={e => updateForm("receitaInicial", e.target.value)}
                      />
                    </div>

                    {/* Periodo Ponderado Inicial */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Período Ponderado Inicial <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={form.periodoPonderadoInicial}
                        onChange={e => updateForm("periodoPonderadoInicial", e.target.value)}
                      />
                    </div>

                    {/* Receita Final */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Receita Final <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={form.receitaFinal}
                        onChange={e => updateForm("receitaFinal", e.target.value)}
                      />
                    </div>

                    {/* Periodo Ponderado Final */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Período Ponderado Final <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={form.periodoPonderadoFinal}
                        onChange={e => updateForm("periodoPonderadoFinal", e.target.value)}
                      />
                    </div>

                    {/* Total de Receita (calculado/PHC) */}
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Total de Receita</Label>
                      <Input value={clientData.totalReceita} disabled className="bg-muted/50" />
                    </div>

                    {/* Prazo (meses) */}
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Prazo (meses)</Label>
                      <Input value={String(clientData.prazoMeses)} disabled className="bg-muted/50" />
                    </div>
                  </div>

                  <Separator className="my-2" />

                  {/* Flags Sim/Não */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fatura Eletrónica <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.faturaEletronica} onValueChange={v => updateForm("faturaEletronica", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Marketing Flag <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.marketingFlag} onValueChange={v => updateForm("marketingFlag", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Portabilidade <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.portabilidade} onValueChange={v => updateForm("portabilidade", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Envio de Equipamento/Vales <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.envioEquipamento} onValueChange={v => updateForm("envioEquipamento", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Contrato OA - Oferta Avançada <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.contratoOa} onValueChange={v => updateForm("contratoOa", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">NPC <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.npc} onValueChange={v => updateForm("npc", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Débito Direto <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.debitoDireto} onValueChange={v => updateForm("debitoDireto", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Marcações <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.marcacoes} onValueChange={v => updateForm("marcacoes", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Permanência Final 30 Meses <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.permanenciaFinal30} onValueChange={v => updateForm("permanenciaFinal30", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Central <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.central} onValueChange={v => updateForm("central", v)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Wifi <span className="text-destructive">*</span></Label>
                      <SimNaoSelect value={form.wifi} onValueChange={v => updateForm("wifi", v)} />
                    </div>
                  </div>

                  <Separator className="my-2" />

                  {/* Famílias e Alarmes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Famílias Inicial <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={form.familiasInicial}
                        onChange={e => updateForm("familiasInicial", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Famílias Final <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={form.familiasFinal}
                        onChange={e => updateForm("familiasFinal", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Alarmes</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={form.alarmes}
                        onChange={e => updateForm("alarmes", e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator className="my-2" />

                  {/* Ficheiros */}
                  <div className="space-y-3">
                    <Label className="text-xs">Ficheiros</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("contrato-file-input")?.click()}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Escolher ficheiros
                      </Button>
                      <input
                        id="contrato-file-input"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {files.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {files.length} ficheiro{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {files.length > 0 && (
                      <div className="space-y-1.5">
                        {files.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => removeFile(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator className="my-2" />

                  {/* Notas */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notas Adicionais</Label>
                    <Textarea
                      placeholder="Observações sobre o contrato..."
                      value={form.notas}
                      onChange={e => updateForm("notas", e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* IDs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Novos IDs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="space-y-1.5 w-48">
                      <Label className="text-xs">Quantidade de novos IDs</Label>
                      <Select value={quantidadeIds} onValueChange={v => { setQuantidadeIds(v); setIds([]); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddIds}
                      disabled={!quantidadeIds || ids.length > 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {ids.length > 0 && (
                    <div className="space-y-4">
                      {ids.map((id, index) => (
                        <Card key={index} className={id.saved ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10" : ""}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                ID {index + 1}
                                {id.saved && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Check className="h-3 w-3 mr-1" />
                                    Gravado
                                  </Badge>
                                )}
                              </CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {ID_CHECKBOX_FIELDS.map(field => (
                                <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={id[field.key] as boolean}
                                    onCheckedChange={(checked) => updateIdCheckbox(index, field.key, checked === true)}
                                    disabled={id.saved}
                                  />
                                  <span className="text-sm">{field.label}</span>
                                </label>
                              ))}
                            </div>

                            {/* Ficheiros do ID */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={id.saved}
                                  onClick={() => document.getElementById(`id-file-input-${index}`)?.click()}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Escolher ficheiros
                                </Button>
                                <input
                                  id={`id-file-input-${index}`}
                                  type="file"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files) addIdFiles(index, e.target.files);
                                    e.target.value = "";
                                  }}
                                />
                                {id.files.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {id.files.length} ficheiro{id.files.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              {id.files.length > 0 && (
                                <div className="space-y-1">
                                  {id.files.map((file, fi) => (
                                    <div key={fi} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="flex-1 truncate text-xs">{file.name}</span>
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {(file.size / 1024).toFixed(0)} KB
                                      </span>
                                      {!id.saved && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 shrink-0"
                                          onClick={() => removeIdFile(index, fi)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Gravar ID */}
                            {!id.saved && (
                              <div className="flex justify-end">
                                <Button size="sm" onClick={() => saveId(index)}>
                                  <Check className="h-4 w-4 mr-1" />
                                  Gravar ID
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Botão Criar Contrato */}
              <div className="flex justify-end gap-2 pb-4">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  Criar Contrato
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
