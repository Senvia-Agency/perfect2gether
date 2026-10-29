import { LockKeyhole, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  EdpCertificateHistory,
  EdpDraftPayload,
  EdpPersonRole,
} from "@/lib/edp/validation";
import { getUniqueDecisionMakers, updateSupplyPoint } from "../payload";
import { EdpPreferencesFields } from "./EdpPreferencesFields";

type EdpSaleDataStepProps = {
  readonly payload: EdpDraftPayload;
  readonly people: readonly EdpPersonRole[];
  readonly certificates: readonly EdpCertificateHistory[];
  readonly negotiationType: string | null;
  readonly onChange: (payload: EdpDraftPayload) => void;
  readonly onRenewCertificate: () => void;
  readonly canManage: boolean;
};

const ENERGY_LABELS = {
  ee: "Eletricidade",
  gn: "Gás natural",
  ee_gn: "Eletricidade + gás",
} as const;

export function EdpSaleDataStep({
  payload,
  people,
  certificates,
  negotiationType,
  onChange,
  onRenewCertificate,
  canManage,
}: EdpSaleDataStepProps) {
  const decisionMakers = useMemo(() => getUniqueDecisionMakers(people), [people]);
  const selectedCertificate = certificates.find((item) => item.version_id === payload.certificate_version_id);

  const selectResponsible = (personId: string) => {
    const person = decisionMakers.find((item) => item.person_id === personId);
    onChange({
      ...payload,
      responsible_person_id: person?.person_id ?? null,
      responsible: person ? { name: person.name, phone: person.phone ?? "", email: person.email ?? "" } : null,
      confirm_client_contact_sync: false,
    });
  };

  return (
    <fieldset disabled={!canManage} className="space-y-6">
      <legend className="sr-only">Edição dos dados do processo EDP</legend>
      <section className="grid gap-4 md:grid-cols-2" aria-labelledby="edp-contract-title">
        <div className="md:col-span-2">
          <h3 id="edp-contract-title" className="text-sm font-semibold">Contrato EDP</h3>
          <p className="text-xs text-muted-foreground">Confirme os dados reais; a data da venda nunca substitui o início do contrato.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edp-energy-type">Energia</Label>
          <Select
            value={payload.energy_type}
            onValueChange={(value) => {
              if (value === "ee" || value === "gn" || value === "ee_gn") onChange({ ...payload, energy_type: value });
            }}
          >
            <SelectTrigger id="edp-energy-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ENERGY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edp-proposal-number">Número da proposta EDP</Label>
          <Input
            id="edp-proposal-number"
            value={payload.proposal_number}
            onChange={(event) => onChange({ ...payload, proposal_number: event.currentTarget.value })}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <p className="text-xs text-muted-foreground">Negociação</p>
          <p className="text-sm font-medium">{negotiationType || "Não indicada"}</p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="edp-points-title">
        <div>
          <h3 id="edp-points-title" className="text-sm font-semibold">Pontos de fornecimento</h3>
          <p className="text-xs text-muted-foreground">Cada CPE/CUI mantém a sua própria data contratual.</p>
        </div>
        {payload.supply_points.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sem CPE ou CUI associado à proposta.</p>
        ) : payload.supply_points.map((point, index) => (
          <div key={`${point.kind}-${point.code}-${index}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,14rem)] sm:items-end">
            <Badge variant="outline" className="w-fit uppercase">{point.kind}</Badge>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="break-all font-mono text-sm font-medium">{point.code}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edp-contract-date-${index}`}>Início do contrato</Label>
              <Input
                id={`edp-contract-date-${index}`}
                type="date"
                value={point.contract_start_date ?? ""}
                onChange={(event) => onChange(updateSupplyPoint(payload, index, {
                  contract_start_date: event.currentTarget.value || null,
                }))}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="edp-responsible-title">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 id="edp-responsible-title" className="text-sm font-semibold">Responsável</h3>
        </div>
        <Select value={payload.responsible_person_id ?? "none"} onValueChange={selectResponsible}>
          <SelectTrigger aria-label="Selecionar responsável"><SelectValue placeholder="Selecionar decisor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Por selecionar</SelectItem>
            {decisionMakers.map((person) => (
              <SelectItem key={person.person_id} value={person.person_id}>
                {person.name}{person.is_complete ? "" : " · contacto incompleto"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {payload.responsible && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edp-responsible-phone">Telefone</Label>
              <Input id="edp-responsible-phone" value={payload.responsible.phone} onChange={(event) => onChange({
                ...payload,
                responsible: { ...payload.responsible, phone: event.currentTarget.value },
              })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edp-responsible-email">Email</Label>
              <Input id="edp-responsible-email" type="email" value={payload.responsible.email} onChange={(event) => onChange({
                ...payload,
                responsible: { ...payload.responsible, email: event.currentTarget.value },
              })} />
            </div>
            <Label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border p-3 md:col-span-2">
              <Checkbox checked={payload.confirm_client_contact_sync} onCheckedChange={(checked) => onChange({
                ...payload,
                confirm_client_contact_sync: checked === true,
              })} />
              <span className="text-sm">Confirmo que telefone e email devem atualizar apenas esta pessoa no cliente.</span>
            </Label>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="edp-certificate-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h3 id="edp-certificate-title" className="text-sm font-semibold">Certidão permanente</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRenewCertificate}>
            <RefreshCw className="mr-2 h-4 w-4" />Renovar CRC
          </Button>
        </div>
        <Select value={payload.certificate_version_id ?? "none"} onValueChange={(value) => onChange({
          ...payload,
          certificate_version_id: value === "none" ? null : value,
        })}>
          <SelectTrigger aria-label="Selecionar versão da certidão"><SelectValue placeholder="Selecionar CRC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem versão selecionada</SelectItem>
            {certificates.map((certificate) => (
              <SelectItem key={certificate.version_id} value={certificate.version_id}>
                {certificate.crc_code || "Sem código"} · {certificate.valid_until || "validade desconhecida"}{certificate.is_current ? " · atual" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCertificate && (
          <p className="text-xs text-muted-foreground">
            Origem: {selectedCertificate.source} · registada em {new Date(selectedCertificate.recorded_at).toLocaleDateString("pt-PT")}
          </p>
        )}
        <div className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />
          A extração paga permanece bloqueada. A renovação é manual e mantém o histórico.
        </div>
      </section>

      <EdpPreferencesFields payload={payload} onChange={onChange} />
    </fieldset>
  );
}
