import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalRequests, useInternalRequestAttachments, openInternalRequestFile } from '@/hooks/useInternalRequests';
import { formatCurrency, formatDate } from '@/lib/format';
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS, REQUEST_ACCEPTED_FILES } from '@/types/internal-requests';
import type { InternalRequest, InternalRequestAttachment } from '@/types/internal-requests';

interface Props {
  request: InternalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canApprove: boolean;
  canDeleteAny: boolean;
  onDelete: (request: InternalRequest) => void;
}

export function ReviewRequestModal({ request, open, onOpenChange, canApprove, canDeleteAny, onDelete }: Props) {
  const { session } = useAuth();
  const { reviewRequest } = useInternalRequests();
  const { attachments, isLoading: loadingAttachments, addAttachments, removeAttachment } = useInternalRequestAttachments(request?.id);
  const [notes, setNotes] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  if (!request) return null;

  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const canReview = canApprove && (isPending || isApproved);
  const isOwner = request.submitted_by === session?.user.id;
  const canAddDocs = canApprove || (isOwner && isPending);
  const canDeleteRequest = canDeleteAny || (isOwner && isPending);
  const canRemoveDoc = (att: InternalRequestAttachment) =>
    canDeleteAny || (isOwner && isPending && att.uploaded_by === session?.user.id);

  const handleAction = async (status: 'approved' | 'rejected' | 'paid') => {
    await reviewRequest.mutateAsync({
      id: request.id,
      status,
      review_notes: notes || undefined,
      payment_reference: paymentRef || undefined,
    });
    setNotes('');
    setPaymentRef('');
    onOpenChange(false);
  };

  const handleRemoveDoc = (att: InternalRequestAttachment) => {
    if (window.confirm(`Eliminar o documento "${att.file_name}"?`)) removeAttachment.mutate(att);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {request.title}
            <Badge className={REQUEST_STATUS_COLORS[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {request.submitter?.full_name && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Submetido por:</span>
                <p className="font-medium">{request.submitter.full_name}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Tipo:</span>
              <p className="font-medium">{REQUEST_TYPE_LABELS[request.request_type]}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data de submissão:</span>
              <p className="font-medium">{formatDate(request.submitted_at)}</p>
            </div>
            {request.amount != null && (
              <div>
                <span className="text-muted-foreground">Valor:</span>
                <p className="font-medium">{formatCurrency(request.amount)}</p>
              </div>
            )}
            {request.expense_date && (
              <div>
                <span className="text-muted-foreground">Data da despesa:</span>
                <p className="font-medium">{formatDate(request.expense_date)}</p>
              </div>
            )}
            {request.period_start && (
              <div>
                <span className="text-muted-foreground">Período:</span>
                <p className="font-medium">{formatDate(request.period_start)} — {request.period_end ? formatDate(request.period_end) : '...'}</p>
              </div>
            )}
          </div>

          {request.description && (
            <div>
              <span className="text-sm text-muted-foreground">Descrição:</span>
              <p className="mt-1 text-sm whitespace-pre-wrap">{request.description}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Documentos ({attachments.length})</span>
              {canAddDocs && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-primary hover:underline">
                  {addAttachments.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Adicionar
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept={REQUEST_ACCEPTED_FILES}
                    disabled={addAttachments.isPending}
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (picked.length > 0) addAttachments.mutate(picked);
                    }}
                  />
                </label>
              )}
            </div>
            {loadingAttachments ? (
              <p className="text-sm text-muted-foreground">A carregar...</p>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem documentos anexados</p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((att) => (
                  <li key={att.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                    <button
                      type="button"
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
                      onClick={() => openInternalRequestFile(att.file_path).catch(() => toast.error('Erro ao abrir documento'))}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">{att.file_name}</span>
                    </button>
                    {canRemoveDoc(att) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={removeAttachment.isPending}
                        onClick={() => handleRemoveDoc(att)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {request.review_notes && (
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium text-muted-foreground">Notas de revisão:</span>
              <p className="mt-1 text-sm">{request.review_notes}</p>
            </div>
          )}

          {request.payment_reference && (
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium text-muted-foreground">Referência de pagamento:</span>
              <p className="mt-1 text-sm">{request.payment_reference}</p>
            </div>
          )}

          {canReview && (
            <>
              <div className="space-y-2">
                <Label htmlFor="reviewNotes">Notas de revisão</Label>
                <Textarea id="reviewNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações..." rows={2} />
              </div>

              {isApproved && (
                <div className="space-y-2">
                  <Label htmlFor="paymentRef">Referência de pagamento</Label>
                  <Input id="paymentRef" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Ex: TRF-12345" />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {isPending && (
                  <>
                    <Button onClick={() => handleAction('approved')} disabled={reviewRequest.isPending}>
                      {reviewRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Aprovar
                    </Button>
                    <Button variant="destructive" onClick={() => handleAction('rejected')} disabled={reviewRequest.isPending}>
                      Rejeitar
                    </Button>
                  </>
                )}
                {isApproved && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction('paid')} disabled={reviewRequest.isPending}>
                    {reviewRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Marcar como Pago
                  </Button>
                )}
              </div>
            </>
          )}

          {canDeleteRequest && (
            <div className="flex justify-end border-t pt-3">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(request)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar pedido
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
