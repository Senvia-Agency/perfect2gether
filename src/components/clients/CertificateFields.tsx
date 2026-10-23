import { FileText, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  CRC_PATTERN,
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
  readonly onCodeChange: (code: string) => void;
  readonly onLookup: () => void;
}

export function CertificateFields(props: CertificateFieldsProps) {
  const {
    idPrefix, code, required, data, checkedAt, pending, phase, startedAt, elapsedMs,
    error, notice, canResume, storageUnavailable, disabled, onCodeChange, onLookup,
  } = props;
  const stage = phase === 'EXTRACTING' ? 'A extrair dados oficiais' : 'Pedido em fila';
  return <Card>
    <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Certidão Permanente</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-crc`}>Código CRC {required && '*'}</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input id={`${idPrefix}-crc`} value={code} onChange={e => onCodeChange(e.target.value)} placeholder="0000-0000-0000" required={required} pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}" maxLength={14} disabled={disabled} aria-describedby={`${idPrefix}-crc-help`} />
          <Button type="button" variant="outline" onClick={onLookup} disabled={disabled || pending || storageUnavailable || !CRC_PATTERN.test(code.trim())}>
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin motion-reduce:animate-none" /> : <Search className="h-4 w-4 mr-2" />}
            {pending ? 'A importar…' : canResume ? 'Retomar importação' : 'Buscar'}
          </Button>
        </div>
        <p id={`${idPrefix}-crc-help`} className="text-xs text-muted-foreground">Consulte a certidão para preencher os dados oficiais da empresa.</p>
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
      </div>}
    </CardContent>
  </Card>;
}
