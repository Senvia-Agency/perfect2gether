import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wallet, CalendarDays, FileText, Upload, Loader2, X } from 'lucide-react';
import { REQUEST_ACCEPTED_FILES } from '@/types/internal-requests';
import type { RequestType } from '@/types/internal-requests';
import { useInternalRequests } from '@/hooks/useInternalRequests';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_OPTIONS: { value: RequestType; label: string; icon: typeof Wallet }[] = [
  { value: 'expense', label: 'Despesa', icon: Wallet },
  { value: 'vacation', label: 'Férias', icon: CalendarDays },
  { value: 'invoice', label: 'Fatura', icon: FileText },
];

export function SubmitRequestModal({ open, onOpenChange }: Props) {
  const { submitRequest } = useInternalRequests();
  const [type, setType] = useState<RequestType>('expense');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const reset = () => {
    setType('expense');
    setTitle('');
    setDescription('');
    setAmount('');
    setExpenseDate('');
    setPeriodStart('');
    setPeriodEnd('');
    setFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitRequest.mutateAsync({
        request_type: type,
        title,
        description: description || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        expense_date: expenseDate || undefined,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
        files,
      });
      reset();
      onOpenChange(false);
    } catch {
      // toast shown by the mutation
    }
  };

  const showAmount = type === 'expense' || type === 'invoice';
  const showExpenseDate = type === 'expense' || type === 'invoice';
  const showPeriod = type === 'vacation';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Tipo de Pedido</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors',
                      type === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Combustível Janeiro" />
          </div>

          {showAmount && (
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (€)</Label>
              <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          )}

          {showExpenseDate && (
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Data</Label>
              <Input id="expenseDate" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          )}

          {showPeriod && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Início</Label>
                <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fim</Label>
                <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes adicionais..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Documentos (PDF, Excel, Imagem)</Label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted/50">
              <Upload className="h-5 w-5" />
              {files.length > 0 ? 'Adicionar mais ficheiros' : 'Clique para anexar ficheiros'}
              <input
                type="file"
                multiple
                className="hidden"
                accept={REQUEST_ACCEPTED_FILES}
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  e.target.value = '';
                  setFiles((prev) => [...prev, ...picked]);
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <span className="truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!title || submitRequest.isPending}>
              {submitRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submeter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
