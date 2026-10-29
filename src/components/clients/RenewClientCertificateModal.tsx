import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenewClientCertificate } from "@/hooks/useClientEdpData";
import {
  CRC_PATTERN,
  type ClientCertificateHistoryRow,
  type ClientCertificateRenewalTarget,
} from "@/lib/client-certificate";

export interface RenewClientCertificateModalProps {
  readonly target: ClientCertificateRenewalTarget;
  readonly currentVersion: ClientCertificateHistoryRow | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRenewed?: () => void;
}

export function RenewClientCertificateModal({
  target,
  currentVersion,
  open,
  onOpenChange,
  onRenewed,
}: RenewClientCertificateModalProps) {
  const renew = useRenewClientCertificate();
  const [crcCode, setCrcCode] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    if (!open) return;
    setCrcCode(currentVersion?.crc_code ?? "");
    setValidFrom(currentVersion?.valid_from ?? "");
    setValidUntil(currentVersion?.valid_until ?? "");
  }, [open, currentVersion]);

  const validationMessage = useMemo(() => {
    if (crcCode.trim() && !CRC_PATTERN.test(crcCode.trim())) return "Use o formato 0000-0000-0000.";
    if (!validUntil) return "Confirme a data de validade da nova versão.";
    if (validFrom && validUntil < validFrom) return "A validade final não pode ser anterior ao início.";
    return "";
  }, [crcCode, validFrom, validUntil]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validationMessage || renew.isPending) return;
    renew.mutate({
      clientId: target.id,
      expectedCurrentVersionId: currentVersion?.version_id ?? null,
      crcCode: crcCode.trim() || null,
      certificateData: currentVersion?.certificate_data ?? {},
      validFrom: validFrom || null,
      validUntil,
      sourceMetadata: { validity_confirmed_manually: true },
    }, {
      onSuccess: () => {
        onOpenChange(false);
        onRenewed?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Renovar CRC</DialogTitle>
          <DialogDescription>
            Crie uma nova versão para {target.name}. A versão atual permanece no histórico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="renew-crc-code">Código CRC</Label>
            <Input
              id="renew-crc-code"
              value={crcCode}
              onChange={event => setCrcCode(event.target.value)}
              placeholder="0000-0000-0000"
              pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}"
              maxLength={14}
              disabled={renew.isPending}
            />
            <p className="text-xs text-muted-foreground">Pode manter o código atual ou indicar o código de substituição.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="renew-valid-from">Válida desde</Label>
              <Input id="renew-valid-from" type="date" value={validFrom} onChange={event => setValidFrom(event.target.value)} disabled={renew.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="renew-valid-until">Válida até *</Label>
              <Input id="renew-valid-until" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} required disabled={renew.isPending} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A consulta ou importação não confirma a validade. Esta data fica registada como confirmação manual.</p>
          {validationMessage && <p role="alert" className="text-sm text-destructive">{validationMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={renew.isPending}>Cancelar</Button>
            <Button type="submit" disabled={!!validationMessage || renew.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {renew.isPending ? "A renovar..." : "Guardar nova versão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
