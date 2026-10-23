import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  readonly restored: boolean;
  readonly error: string;
  readonly disabled: boolean;
  readonly onDiscard: () => void;
};
export function ClientFormDraftNotice({ restored, error, disabled, onDiscard }: Props) {
  return <div className="mb-4 space-y-2 rounded-lg border bg-muted/30 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="flex items-center gap-2 text-sm font-medium"><Save className="h-4 w-4 shrink-0" />{restored ? 'Rascunho recuperado' : 'Rascunho automático'}</p>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onDiscard}>Descartar rascunho</Button>
    </div>
    <p className="text-xs text-muted-foreground">{error ? 'O rascunho não está protegido neste navegador.' : 'Pode fechar esta ficha ou atualizar a página. Os dados ficam neste navegador durante 24 horas, até guardar ou descartar.'}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
