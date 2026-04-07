import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import type { CatalogProduct } from '@/types/proposals';
import type { Json } from '@/integrations/supabase/types';

export function ServicosProductsManager() {
  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const saved = (org as any)?.servicos_products_config as CatalogProduct[] | null;
    if (saved && Array.isArray(saved) && saved.length > 0 && typeof saved[0].price === 'number') {
      setProducts(saved);
    } else {
      // Start with empty catalog for new orgs
      setProducts([]);
    }
  }, [org]);

  const handleSave = () => {
    updateOrg.mutate({ servicos_products_config: products as unknown as Json });
  };

  const addProduct = () => {
    if (!newName.trim()) return;
    if (products.some(p => p.name.toLowerCase() === newName.trim().toLowerCase())) return;
    setProducts(prev => [...prev, {
      name: newName.trim(),
      price: 0,
      has_commission: false,
      commission_pct: 0,
    }]);
    setNewName('');
  };

  const removeProduct = (name: string) => {
    setProducts(prev => prev.filter(p => p.name !== name));
  };

  const updateProduct = (name: string, updates: Partial<CatalogProduct>) => {
    setProducts(prev => prev.map(p =>
      p.name === name ? { ...p, ...updates } : p
    ));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Produtos Telecom (Serviços)
        </CardTitle>
        <CardDescription>
          Configure os produtos disponíveis para propostas e vendas de "Outros Serviços". 
          Na hora da venda, os valores podem ser editados sem alterar o catálogo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((product) => (
          <div key={product.name} className="p-4 rounded-lg border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{product.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProduct(product.name)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Preço Base (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.price || ''}
                  onChange={(e) => updateProduct(product.name, { price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tem Comissão?</Label>
                <div className="flex items-center h-9">
                  <Switch
                    checked={product.has_commission}
                    onCheckedChange={(checked) => updateProduct(product.name, {
                      has_commission: checked,
                      commission_pct: checked ? product.commission_pct : 0,
                    })}
                  />
                </div>
              </div>

              {product.has_commission && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Comissão (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={product.commission_pct || ''}
                    onChange={(e) => updateProduct(product.name, { commission_pct: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo produto..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProduct()}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={addProduct} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={updateOrg.isPending} size="sm">
            {updateOrg.isPending ? 'A guardar...' : 'Guardar Produtos'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
