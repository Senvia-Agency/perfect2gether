import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRenewCpe } from '@/hooks/useCpes';

interface RenewCpeModalProps {
  cpeId: string;
  currentEnd: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenewCpeModal({ cpeId, currentEnd, open, onOpenChange }: RenewCpeModalProps) {
  const renewCpe = useRenewCpe();
  const [fidelizacaoStart, setFidelizacaoStart] = useState('');
  const [fidelizacaoEnd, setFidelizacaoEnd] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fidelizacaoEnd) return;

    renewCpe.mutate(
      { id: cpeId, fidelizacao_end: fidelizacaoEnd, fidelizacao_start: fidelizacaoStart || undefined },
      { onSuccess: () => { onOpenChange(false); setFidelizacaoEnd(''); setFidelizacaoStart(''); } }
    );
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Renovar Fidelização</DialogTitle>
          <DialogDescription>
            Fim atual: {new Date(currentEnd).toLocaleDateString('pt-PT')}. Defina a nova data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Novo Início (opcional)</Label>
            <Input type="date" value={fidelizacaoStart} onChange={(e) => setFidelizacaoStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nova Data Fim *</Label>
            <Input type="date" value={fidelizacaoEnd} onChange={(e) => setFidelizacaoEnd(e.target.value)} min={minDate} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!fidelizacaoEnd || renewCpe.isPending}>
              {renewCpe.isPending ? 'A renovar...' : 'Renovar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
