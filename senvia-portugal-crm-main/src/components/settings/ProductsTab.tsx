import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProducts, useDeleteProduct } from '@/hooks/useProducts';
import { useSyncInvoiceXpressItems } from '@/hooks/useSyncInvoiceXpressItems';
import { useAuth } from '@/contexts/AuthContext';
import { ServicosProductsManager } from './ServicosProductsManager';
import { CreateProductModal } from './CreateProductModal';
import { EditProductModal } from './EditProductModal';
import type { Product } from '@/types/proposals';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ProductsTab() {
  const { data: products = [], isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();
  const syncItems = useSyncInvoiceXpressItems();
  const { organization } = useAuth();
  const isTelecom = (organization as any)?.niche === 'telecom';
  const hasInvoiceXpress = !!(organization as any)?.invoicexpress_api_key && !!(organization as any)?.invoicexpress_account_name;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const handleDelete = () => {
    if (deletingProduct) {
      deleteProduct.mutate(deletingProduct.id, {
        onSuccess: () => setDeletingProduct(null),
      });
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos & Serviços
            </CardTitle>
            <CardDescription>
              Gerir o catálogo de produtos e serviços da organização.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasInvoiceXpress && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncItems.mutate()}
                disabled={syncItems.isPending}
              >
                {syncItems.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar
              </Button>
            )}
            <Button onClick={() => setCreateModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Ainda não tem produtos configurados.</p>
              <p className="text-sm">Adicione produtos para criar propostas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {product.code && (
                        <span className="text-xs font-mono text-muted-foreground">#{product.code}</span>
                      )}
                      <h4 className="font-medium truncate">{product.name}</h4>
                      {product.is_recurring && (
                        <Badge variant="outline" className="text-xs gap-1 bg-primary/10 text-primary border-primary/30">
                          <RefreshCw className="h-3 w-3" />
                          Mensal
                        </Badge>
                      )}
                      {!product.is_active && (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-primary whitespace-nowrap">
                      {formatPrice(product.price)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingProduct(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingProduct(product)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateProductModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
      />

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que pretende eliminar "{deletingProduct?.name}"? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isTelecom && <ServicosProductsManager />}
    </div>
  );
}
