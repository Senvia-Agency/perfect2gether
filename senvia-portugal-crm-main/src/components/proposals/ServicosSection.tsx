/**
 * Shared "Outros Serviços" section for proposals/sales.
 * Supports both legacy (fields-based) and new catalog format.
 */
import { Wrench, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SearchableCombobox, type ComboboxOption } from '@/components/ui/searchable-combobox';
import type {
  ServicosDetails,
  ServicosProductDetail,
  ServicosProductConfig,
  CatalogProduct,
  ModeloServico,
} from '@/types/proposals';
import { FIELD_LABELS } from '@/types/proposals';

interface ServicosSectionProps {
  modeloServico: ModeloServico;
  onModeloServicoChange: (v: ModeloServico) => void;
  servicosProdutos: string[];
  servicosDetails: ServicosDetails;
  attempted?: boolean;
  isNewFormat: boolean;
  configs?: ServicosProductConfig[];
  catalog?: CatalogProduct[] | null;
  onToggleProduct: (name: string) => void;
  /** For legacy format: update a single numeric field */
  onUpdateDetail: (product: string, field: string, value: number | undefined) => void;
  /** For new format: set the full details for a product */
  onSetProductDetail: (product: string, detail: ServicosProductDetail) => void;
  isAutoCalculated?: (product: string) => boolean;
  totalKwp?: number;
  totalComissao?: number;
  hideModeloServico?: boolean;
}

export function ServicosSection({
  modeloServico,
  onModeloServicoChange,
  servicosProdutos,
  servicosDetails,
  attempted,
  isNewFormat,
  configs = [],
  catalog,
  onToggleProduct,
  onUpdateDetail,
  onSetProductDetail,
  isAutoCalculated,
  totalKwp,
  totalComissao,
  hideModeloServico,
}: ServicosSectionProps) {
  return (
    <div className="space-y-4 p-4 rounded-lg border bg-secondary/30 border-border">
      <div className="flex items-center gap-2 text-foreground">
        <Wrench className="h-4 w-4" />
        <span className="font-medium text-sm">Outros Serviços</span>
      </div>

      {/* Modelo de Serviço */}
      {!hideModeloServico && (
        <div className="space-y-2">
          <Label className="text-sm">Modelo de Serviço</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={modeloServico === 'transacional' ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => onModeloServicoChange('transacional')}>
              Transacional
            </Button>
            <Button type="button" variant={modeloServico === 'saas' ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => onModeloServicoChange('saas')}>
              SAAS
            </Button>
          </div>
        </div>
      )}

      {isNewFormat && catalog ? (
        <CatalogProducts
          catalog={catalog}
          servicosProdutos={servicosProdutos}
          servicosDetails={servicosDetails}
          onToggleProduct={onToggleProduct}
          onSetProductDetail={onSetProductDetail}
          attempted={attempted}
        />
      ) : (
        <LegacyProducts
          configs={configs}
          servicosProdutos={servicosProdutos}
          servicosDetails={servicosDetails}
          onToggleProduct={onToggleProduct}
          onUpdateDetail={onUpdateDetail}
          isAutoCalculated={isAutoCalculated}
          attempted={attempted}
          totalKwp={totalKwp}
          totalComissao={totalComissao}
        />
      )}
    </div>
  );
}

// ─── New Catalog Format ───

function CatalogProducts({
  catalog,
  servicosProdutos,
  servicosDetails,
  onToggleProduct,
  onSetProductDetail,
  attempted,
}: {
  catalog: CatalogProduct[];
  servicosProdutos: string[];
  servicosDetails: ServicosDetails;
  onToggleProduct: (name: string) => void;
  onSetProductDetail: (product: string, detail: ServicosProductDetail) => void;
  attempted?: boolean;
}) {
  const totalComissao = servicosProdutos.reduce((sum, p) => sum + (servicosDetails[p]?.comissao || 0), 0);
  const totalPrice = servicosProdutos.reduce((sum, p) => sum + (servicosDetails[p]?.price || 0), 0);

  // Build combobox options from catalog, excluding already selected
  const comboboxOptions: ComboboxOption[] = catalog
    .filter((c) => !servicosProdutos.includes(c.name))
    .map((c) => ({
      value: c.name,
      label: c.name,
      sublabel: c.price.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }),
    }));

  const handleAddProduct = (value: string | null) => {
    if (!value) return;
    onToggleProduct(value);
    const catProduct = catalog.find((c) => c.name === value);
    if (catProduct) {
      const comissaoVal = catProduct.has_commission
        ? Math.round(catProduct.price * catProduct.commission_pct) / 100
        : 0;
      onSetProductDetail(value, {
        price: catProduct.price,
        commission_pct: catProduct.commission_pct,
        comissao: comissaoVal,
      });
    }
  };

  return (
    <>
      <div className="space-y-3">
        <Label className="text-sm">Produtos do Catálogo</Label>
        {attempted && servicosProdutos.length === 0 && (
          <p className="text-xs text-destructive">Selecione pelo menos 1 produto</p>
        )}

        {/* Searchable dropdown to add products */}
        <SearchableCombobox
          options={comboboxOptions}
          value={null}
          onValueChange={handleAddProduct}
          placeholder="Pesquisar e adicionar produto..."
          searchPlaceholder="Escreva para pesquisar..."
          emptyText="Nenhum produto encontrado."
          emptyValue="__none__"
          emptyLabel="Nenhum"
        />

        {/* Selected products as editable cards */}
        {servicosProdutos.map((productName) => {
          const catProduct = catalog.find((c) => c.name === productName);
          if (!catProduct) return null;
          const detail = servicosDetails[productName] || {};
          const price = detail.price ?? catProduct.price;
          const commissionPct = detail.commission_pct ?? catProduct.commission_pct;

          return (
            <div key={productName} className="p-3 rounded-md bg-muted/50 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{detail.name ?? productName}</span>
                  {catProduct.has_commission && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {commissionPct}% comissão
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onToggleProduct(productName)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={detail.name ?? catProduct.name}
                    onChange={(e) => {
                      onSetProductDetail(productName, { ...detail, name: e.target.value });
                    }}
                    className="h-8 text-sm"
                    placeholder={catProduct.name}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preço (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => {
                      const newPrice = parseFloat(e.target.value) || 0;
                      const comissao = catProduct.has_commission ? Math.round(newPrice * commissionPct) / 100 : 0;
                      onSetProductDetail(productName, { ...detail, price: newPrice, comissao });
                    }}
                    className="h-8"
                  />
                </div>
                {catProduct.has_commission && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Comissão (%)</Label>
                    <Input
                      type="number"
                      value={commissionPct}
                      readOnly
                      className="h-8 bg-muted cursor-not-allowed opacity-70"
                    />
                  </div>
                )}
              </div>
              {catProduct.has_commission && (
                <div className="text-xs text-muted-foreground">
                  Comissão: <span className="font-medium text-foreground">
                    {(price * commissionPct / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {servicosProdutos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor Total (€)</Label>
            <div className="h-8 flex items-center text-sm font-medium px-3 rounded-md bg-muted">
              {totalPrice ? totalPrice.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '—'}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Comissão Total (€)</Label>
            <div className="h-8 flex items-center text-sm font-medium px-3 rounded-md bg-muted">
              {totalComissao ? totalComissao.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '—'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Legacy Format ───

function LegacyProducts({
  configs,
  servicosProdutos,
  servicosDetails,
  onToggleProduct,
  onUpdateDetail,
  isAutoCalculated,
  attempted,
  totalKwp,
  totalComissao,
}: {
  configs: ServicosProductConfig[];
  servicosProdutos: string[];
  servicosDetails: ServicosDetails;
  onToggleProduct: (name: string) => void;
  onUpdateDetail: (product: string, field: string, value: number | undefined) => void;
  isAutoCalculated?: (product: string) => boolean;
  attempted?: boolean;
  totalKwp?: number;
  totalComissao?: number;
}) {
  return (
    <>
      <div className="space-y-3">
        <Label className="text-sm">Produtos</Label>
        {attempted && servicosProdutos.length === 0 && (
          <p className="text-xs text-destructive">Selecione pelo menos 1 produto</p>
        )}
        {configs.map((config) => {
          const isActive = servicosProdutos.includes(config.name);
          const detail = servicosDetails[config.name] || {};
          return (
            <div key={config.name} className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`produto-${config.name}`}
                  checked={isActive}
                  onCheckedChange={() => onToggleProduct(config.name)}
                />
                <Label htmlFor={`produto-${config.name}`} className="text-sm cursor-pointer font-medium">
                  {config.name}
                </Label>
              </div>
              {isActive && (
                <div className="ml-6 flex flex-wrap gap-2">
                  {config.fields.map((field) => {
                    const isComissaoAuto = field === 'comissao' && isAutoCalculated?.(config.name);
                    return (
                      <div key={field} className="space-y-1 min-w-[100px] flex-1">
                        <Label className="text-xs text-muted-foreground">
                          {FIELD_LABELS[field]} <span className="text-destructive">*</span>
                          {isComissaoAuto && <span className="ml-1 text-primary">(auto)</span>}
                        </Label>
                        {attempted && (detail[field] === undefined || detail[field] <= 0) && (
                          <p className="text-[10px] text-destructive">Obrigatório</p>
                        )}
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={detail[field] ?? ''}
                          onChange={(e) => onUpdateDetail(config.name, field, e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder={field === 'kwp' && config.kwpAuto ? 'Auto' : '0'}
                          className="h-8"
                          readOnly={(field === 'kwp' && !!config.kwpAuto && detail.valor !== undefined) || !!isComissaoAuto}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">kWp Total</Label>
          <div className="h-8 flex items-center text-sm font-medium px-3 rounded-md bg-muted">
            {totalKwp ? totalKwp.toLocaleString('pt-PT', { maximumFractionDigits: 2 }) : '—'}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Comissão Total (€)</Label>
          <div className="h-8 flex items-center text-sm font-medium px-3 rounded-md bg-muted">
            {totalComissao ? totalComissao.toLocaleString('pt-PT', { maximumFractionDigits: 2 }) : '—'}
          </div>
        </div>
      </div>
    </>
  );
}
