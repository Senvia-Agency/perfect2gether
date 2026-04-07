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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { STATUS_LABELS, LeadStatus } from '@/types';

interface LeadStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (status: LeadStatus) => void;
  isLoading?: boolean;
  leadName?: string;
  actionType: 'delete' | 'cancel';
}

export function LeadStatusDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  leadName,
  actionType,
}: LeadStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('contacted');

  const handleConfirm = () => {
    onConfirm(selectedStatus);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {actionType === 'delete' ? 'Eliminar evento' : 'Cancelar evento'}
          </DialogTitle>
          <DialogDescription>
            {leadName ? (
              <>
                O lead <strong>{leadName}</strong> está associado a este evento.
                Para que status deseja mover o lead?
              </>
            ) : (
              'Tem a certeza que pretende continuar?'
            )}
          </DialogDescription>
        </DialogHeader>

        {leadName && (
          <RadioGroup
            value={selectedStatus}
            onValueChange={(value) => setSelectedStatus(value as LeadStatus)}
            className="grid gap-3 py-4"
          >
            {(Object.entries(STATUS_LABELS) as [LeadStatus, string][]).map(([status, label]) => (
              <div key={status} className="flex items-center space-x-3">
                <RadioGroupItem value={status} id={status} />
                <Label htmlFor={status} className="cursor-pointer font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Voltar
          </Button>
          <Button
            variant={actionType === 'delete' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {actionType === 'delete' ? 'Eliminar' : 'Cancelar evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
