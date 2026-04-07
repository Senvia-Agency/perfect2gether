import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/types/sales";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/types/sales";
import type { DraftPayment } from "./AddDraftPaymentModal";

interface DraftScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remainingAmount: number;
  onAdd: (payments: DraftPayment[]) => void;
}

export function DraftScheduleModal({
  open,
  onOpenChange,
  remainingAmount,
  onAdd,
}: DraftScheduleModalProps) {
  const [installmentCount, setInstallmentCount] = useState(2);
  const [dates, setDates] = useState<Date[]>(() =>
    Array.from({ length: 4 }, (_, i) => addDays(new Date(), (i + 1) * 30))
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");

  const installments = useMemo(() => {
    const base = Math.floor((remainingAmount / installmentCount) * 100) / 100;
    return Array.from({ length: installmentCount }, (_, i) => {
      if (i === installmentCount - 1) {
        return +(remainingAmount - base * (installmentCount - 1)).toFixed(2);
      }
      return base;
    });
  }, [remainingAmount, installmentCount]);

  const updateDate = (index: number, date: Date) => {
    setDates((prev) => {
      const next = [...prev];
      next[index] = date;
      return next;
    });
  };

  const handleSubmit = () => {
    const payments: DraftPayment[] = installments.map((amount, i) => ({
      id: crypto.randomUUID(),
      amount,
      payment_date: format(dates[i], "yyyy-MM-dd"),
      payment_method: paymentMethod || null,
      status: "pending" as const,
      invoice_reference: null,
      notes: `Parcela ${i + 1}/${installmentCount}`,
    }));
    onAdd(payments);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Pagamento Parcelado</AlertDialogTitle>
          <AlertDialogDescription>
            Dividir <strong>{formatCurrency(remainingAmount)}</strong> em parcelas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-5">
          {/* Installment count selector */}
          <div className="space-y-2">
            <Label>Número de parcelas</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={installmentCount === n ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setInstallmentCount(n)}
                >
                  {n}x
                </Button>
              ))}
            </div>
          </div>

          {/* Installment details */}
          <div className="space-y-3">
            {installments.map((amount, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Parcela {i + 1}: {formatCurrency(amount)}
                  </p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal min-w-[130px]",
                        !dates[i] && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(dates[i], "dd/MM/yyyy", { locale: pt })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dates[i]}
                      onSelect={(d) => d && updateDate(i, d)}
                      locale={pt}
                      disabled={(d) => d < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Método de pagamento</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar método..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
            >
              {`Adicionar ${installmentCount} Parcela${installmentCount > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
