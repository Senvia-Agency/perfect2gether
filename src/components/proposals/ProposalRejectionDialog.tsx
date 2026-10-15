import { useState, type FormEvent } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useRejectProposal } from '@/hooks/useRejectProposal';
import { useFinalStages } from '@/hooks/usePipelineStages';
import { proposalRejectionSchema } from '@/lib/proposal-rejection';
import type { Proposal } from '@/types/proposals';

type Props = {
  readonly proposal: Proposal;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
};

export function ProposalRejectionDialog({ proposal, open, onOpenChange, onSuccess }: Props) {
  const rejection = useRejectProposal();
  const { finalNegativeStage } = useFinalStages();
  const [form, setForm] = useState({ reason: '', start: '', end: '', meetingLink: '' });
  const [error, setError] = useState('');
  const setField = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));
  const valid = proposalRejectionSchema.safeParse(form).success;
  const changeOpen = (next: boolean) => {
    if (rejection.isPending) return;
    if (!next) { setForm({ reason: '', start: '', end: '', meetingLink: '' }); setError(''); }
    onOpenChange(next);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = proposalRejectionSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Verifique os campos obrigatórios.'); return; }
    setError('');
    try {
      await rejection.mutateAsync({ proposalId: proposal.id, form: parsed.data, ...(proposal.lead_id && finalNegativeStage ? { leadStatus: finalNegativeStage.key } : {}) });
      setForm({ reason: '', start: '', end: '', meetingLink: '' });
      onOpenChange(false);
      onSuccess();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível guardar a recusa e a reunião. Tente novamente.');
    }
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar proposta {proposal.code}</DialogTitle>
          <DialogDescription>Justifique a recusa e marque uma reunião de acompanhamento com {proposal.client?.name || proposal.lead?.name || 'o cliente'}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6" noValidate>
          <fieldset disabled={rejection.isPending} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da recusa *</Label>
              <Textarea id="rejection-reason" required rows={3} value={form.reason} onChange={event => setField('reason', event.target.value)} placeholder="Explique por que a proposta foi recusada…" />
            </div>
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4 text-primary" />Reunião de acompanhamento</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="rejection-start">Início *</Label><Input id="rejection-start" type="datetime-local" required value={form.start} onChange={event => setField('start', event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="rejection-end">Fim *</Label><Input id="rejection-end" type="datetime-local" required value={form.end} onChange={event => setField('end', event.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="rejection-link">Link da reunião (opcional)</Label><Input id="rejection-link" type="url" value={form.meetingLink} onChange={event => setField('meetingLink', event.target.value)} placeholder="https://…" /></div>
              <p className="text-xs text-muted-foreground">A reunião ficará na sua agenda, associada a esta proposta.</p>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={rejection.isPending} onClick={() => changeOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={!valid || rejection.isPending}>
              {rejection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rejection.isPending ? 'A guardar…' : 'Recusar e marcar reunião'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
