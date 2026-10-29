import { ApiCreditsButton } from '@/components/ApiCreditsButton';
import { Check, FileText, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  formatCertificateElapsed,
  type CertificateImportPhase,
  type ClientCertificate,
} from '@/lib/client-certificate';

interface CertificateFieldsProps {
  readonly idPrefix: string;
  readonly code: string;
  readonly required: boolean;
  readonly data: ClientCertificate | null;
  readonly checkedAt: string | null;
  readonly pending: boolean;
  readonly phase: CertificateImportPhase | null;
  readonly startedAt: string | null;
  readonly elapsedMs: number;
  readonly error: string;
  readonly notice: string;
  readonly canResume: boolean;
  readonly storageUnavailable: boolean;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly onCodeChange: (code: string) => void;
  readonly onLookup: () => void;
  readonly onApply?: () => void;
  readonly onRenew?: () => void;
}

export function CertificateFields(props: CertificateFieldsProps) {
  const {
    idPrefix, code, required, data, checkedAt, pending, phase, startedAt, elapsedMs,
    error, notice, canResume, storageUnavailable, disabled, readOnly = false,
    onCodeChange, onApply, onRenew,
  } = props;
  const stage = phase === 'EXTRACTING' ? 'A extrair dados oficiais' : 'Pedido em fila';
  return <Card>
    <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Certidão Permanente</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-crc`}>Código CRC {required && '*'}</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input id={`${idPrefix}-crc`} value={code} onChange={e => onCodeChange(e.target.value)} placeholder="0000-0000-0000" required={required} pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}" maxLength={14} disabled={disabled} readOnly={readOnly} aria-readonly={readOnly} aria-describedby={`${idPrefix}-crc-help`} />
          {readOnly ? (
            onRenew && <Button type="button" variant="outline" disabled={disabled} onClick={onRenew}>
              <RefreshCw className="mr-2 h-4 w-4" />Renovar CRC
            </Button>
          ) : (
            <ApiCreditsButton disabled={disabled}>
              <Search className="h-4 w-4 mr-2" />Buscar
            </ApiCreditsButton>
          )}
        </div>
        <p id={`${idPrefix}-crc-help`} className="text-xs text-muted-foreground">
          {readOnly
            ? 'O código atual é só de leitura. Use a renovação para guardar uma nova versão sem apagar o histórico.'
            : 'O CRC é opcional. Se indicar um código, use o formato 0000-0000-0000.'}
        </p>
        {pending && <div role="status" aria-live="polite" className="space-y-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">A importar certidão</p>
              <p className="text-xs text-muted-foreground">{stage}</p>
            </div>
            {startedAt && <span className="text-xs tabular-nums text-muted-foreground">Decorrido: {formatCertificateElapsed(elapsedMs)}</span>}
          </div>
          <Progress
            aria-label="Importação da certidão em curso"
            aria-valuetext={stage}
            className="h-1.5 [&>div]:!w-1/3 [&>div]:!translate-x-0 [&>div]:animate-pulse motion-reduce:[&>div]:animate-none"
          />
          <p className="text-xs text-muted-foreground">Pode fechar este formulário ou recarregar a página. Ao regressar, continuaremos a partir do pedido guardado.</p>
        </div>}
        {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {data && <div className="space-y-4 border-t pt-4">
        <section className="space-y-1"><h3 className="text-sm font-medium">Identificação da empresa</h3><p className="text-sm break-words">{data.denominacao}</p><p className="text-xs text-muted-foreground">NIPC: {data.nipc}</p></section>
        <section className="space-y-2"><h3 className="text-sm font-medium">Atividades económicas (CAE)</h3>
          {data.cae.length ? data.cae.map((cae, index) => <div key={`${cae.codigo}-${index}`} className="text-sm"><span className="font-medium">{cae.codigo} · {cae.principal ? 'Principal' : 'Secundário'}</span><p className="text-muted-foreground break-words">{cae.descricao || 'Descrição não disponível'}</p></div>) : <p className="text-sm text-muted-foreground">Sem atividades indicadas na certidão.</p>}
        </section>
        <section className="space-y-2"><h3 className="text-sm font-medium">Gerentes da certidão</h3>
          {data.gerentes.length ? data.gerentes.map((gerente, index) => <div key={`${gerente.nome}-${index}`} className="text-sm"><p className="break-words">{gerente.nome}</p><p className="text-xs text-muted-foreground">NIF: {gerente.nif || 'Não indicado'}</p></div>) : <p className="text-sm text-muted-foreground">Sem gerentes indicados na certidão.</p>}
          <p className="text-xs text-muted-foreground">Os gerentes são dados oficiais e não alteram os contactos dos decisores.</p>
        </section>
        {checkedAt && <p className="text-xs text-muted-foreground">Consultada em {new Date(checkedAt).toLocaleString('pt-PT')}</p>}
        {onApply && !readOnly && <Button type="button" variant="outline" onClick={onApply} disabled={disabled}>
          <Check className="mr-2 h-4 w-4" />Aplicar dados revistos
        </Button>}
      </div>}
    </CardContent>
  </Card>;
}
