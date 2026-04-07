import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { useUpdateProduct } from '@/hooks/useProducts';
import type { Product } from '@/types/proposals';

interface EditProductModalProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductModal({ product, open, onOpenChange }: EditProductModalProps) {
  const updateProduct = useUpdateProduct();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price?.toString() || '');
  const [isActive, setIsActive] = useState(product.is_active);
  const [isRecurring, setIsRecurring] = useState(product.is_recurring);

  useEffect(() => {
    setName(product.name);
    setDescription(product.description || '');
    setPrice(product.price?.toString() || '');
    setIsActive(product.is_active);
    setIsRecurring(product.is_recurring);
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateProduct.mutate({
      id: product.id,
      name: name.trim(),
      description: description.trim() || null,
      price: price ? parseFloat(price) : null,
      is_active: isActive,
      is_recurring: isRecurring,
      tax_value: null,
      tax_exemption_reason: null,
      invoicexpress_id: product.invoicexpress_id,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-price">Preço Base (€)</Label>
            <Input
              id="edit-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <Label htmlFor="edit-recurring" className="font-medium cursor-pointer">
                  Produto Recorrente
                </Label>
              </div>
              <Switch
                id="edit-recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
            {isRecurring && (
              <p className="text-xs text-muted-foreground">
                Este produto é cobrado mensalmente. Vendas com este produto terão opção de renovação.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-active">Produto ativo</Label>
            <Switch
              id="edit-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateProduct.isPending || !name.trim()}>
              {updateProduct.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}