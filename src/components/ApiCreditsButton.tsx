import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { API_CREDITS_MESSAGE } from '@/lib/api-extraction-credits';

export function ApiCreditsButton({ children, disabled = false }: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
      {children}
    </Button>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Créditos de API</AlertDialogTitle>
          <AlertDialogDescription>{API_CREDITS_MESSAGE}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogAction>Entendido</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
