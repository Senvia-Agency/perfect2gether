import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useUpdateExpense } from '@/hooks/useExpenses';
import { useExpenseCategories } from '@/hooks/useExpenseCategories';
import { BankAccountSelect } from '@/components/finance/BankAccountSelect';
import type { Expense } from '@/types/expenses';

interface EditExpenseModalProps {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExpenseModal({ expense, open, onOpenChange }: EditExpenseModalProps) {
  const updateExpense = useUpdateExpense();
  const { data: categories } = useExpenseCategories();

  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [categoryId, setCategoryId] = useState(expense.category_id || '');
  const [date, setDate] = useState<Date>(parseISO(expense.expense_date));
  const [isRecurring, setIsRecurring] = useState(expense.is_recurring);
  const [notes, setNotes] = useState(expense.notes || '');
  const [bankAccountId, setBankAccountId] = useState((expense as any).bank_account_id || '');

  useEffect(() => {
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setCategoryId(expense.category_id || '');
    setDate(parseISO(expense.expense_date));
    setIsRecurring(expense.is_recurring);
    setNotes(expense.notes || '');
    setBankAccountId((expense as any).bank_account_id || '');
  }, [expense]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || isNaN(numericAmount) || numericAmount <= 0) return;

    updateExpense.mutate(
      {
        id: expense.id,
        description: description.trim(),
        amount: numericAmount,
        category_id: categoryId && categoryId !== 'none' ? categoryId : null,
        expense_date: format(date, 'yyyy-MM-dd'),
        is_recurring: isRecurring,
        notes: notes.trim() || null,
        bank_account_id: bankAccountId && bankAccountId !== 'none' ? bankAccountId : null,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Despesa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-exp-desc">Descrição *</Label>
            <Input
              id="edit-exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Renda do escritório"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-exp-cat">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="edit-exp-cat">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-exp-amount">Valor (€) *</Label>
              <Input
                id="edit-exp-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'dd/MM/yyyy', { locale: pt })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    locale={pt}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-exp-recurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => setIsRecurring(checked === true)}
                />
                <Label htmlFor="edit-exp-recurring" className="cursor-pointer">Recorrente</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-exp-notes">Notas</Label>
            <Textarea
              id="edit-exp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais..."
              rows={2}
            />
          </div>

          <BankAccountSelect value={bankAccountId} onChange={setBankAccountId} />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateExpense.isPending || !description.trim() || !amount}>
              {updateExpense.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
