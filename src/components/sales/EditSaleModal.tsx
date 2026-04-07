import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox, type ComboboxOption } from "@/components/ui/searchable-combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useUpdateSale } from "@/hooks/useSales";
import { useSaleItems, useCreateSaleItems, useUpdateSaleItem, useDeleteSaleItem } from "@/hooks/useSaleItems";
import { useCreateSalePayment, useSalePayments, calculatePaymentSummary } from "@/hooks/useSalePayments";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { format, parseISO } from "date-fns";
import { ClientFiscalCard, VatBadge, useVatCalculation, isInvoiceXpressActive, getOrgTaxValue } from "./SaleFiscalInfo";
import { supabase } from "@/integrations/supabase/client";
import { pt } from "date-fns/locale";
import { SALE_STATUS_LABELS, SALE_STATUS_COLORS } from "@/types/sales";
import { toast } from "sonner";
import { 
  Loader2, 
  CalendarIcon, 
  Plus, 
  Minus, 
  X, 
  Package, 
  User,
  FileText,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Zap,
  Wrench,
} from "lucide-react";

import type { SaleWithDetails } from "@/types/sales";
import { SalePaymentsList } from "./SalePaymentsList";
import { RecurringSection } from "./RecurringSection";
import { Progress } from "@/components/ui/progress";
import { useProposalCpes, useUpdateProposalCpes } from "@/hooks/useProposalCpes";
import type { CreateProposalCpeData } from "@/hooks/useProposalCpes";
import { useCpes } from "@/hooks/useCpes";
import { NEGOTIATION_TYPE_LABELS, NEGOTIATION_TYPES, MODELO_SERVICO_LABELS } from "@/types/proposals";
import type { ServicosDetails } from "@/types/proposals";
import { useServicosProducts } from '@/hooks/useServicosProducts';
import { ServicosSection } from '@/components/proposals/ServicosSection';
import { useCommissionMatrix, getVolumeTier } from "@/hooks/useCommissionMatrix";
import type { NegotiationType, ModeloServico } from "@/types/proposals";
import { Checkbox } from "@/components/ui/checkbox";
import { CPE_STATUS_LABELS, CPE_STATUS_STYLES } from "@/types/cpes";
import { useSaleFieldsSettings } from "@/hooks/useSaleFieldsSettings";

interface SaleItemDraft {
  id: string;
  originalId?: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  first_due_date?: Date | null;
  isNew?: boolean;
  isModified?: boolean;
}

interface EditSaleModalProps {
  sale: SaleWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditSaleModal({ 
  sale, 
  open, 
  onOpenChange, 
  onSuccess
}: EditSaleModalProps) {
  const { data: clients } = useClients();
  const { products: catalogProductNames, configs: SERVICOS_PRODUCT_CONFIGS, catalog, isNewFormat } = useServicosProducts();
  const { data: products } = useProducts();
  const { data: existingItems = [] } = useSaleItems(sale?.id);
  
  const updateSale = useUpdateSale();
  const createSaleItems = useCreateSaleItems();
  const updateSaleItem = useUpdateSaleItem();
  const deleteSaleItem = useDeleteSaleItem();
  const createSalePayment = useCreateSalePayment();

  const { organization } = useAuth();
  const { isAdmin } = usePermissions();
  const isTelecom = organization?.niche === 'telecom';
  const { modules } = useModules();
  const showEnergy = isTelecom && modules.energy;
  const { data: saleFields } = useSaleFieldsSettings();
  const { calculateCommission, isAutoCalculated, calculateEnergyCommission, hasEnergyConfig } = useCommissionMatrix();
  const { data: orgData } = useOrganization();
  const salesSettings = (orgData?.sales_settings as { lock_delivered_sales?: boolean }) || {};
  const isDeliveredLocked = !!salesSettings.lock_delivered_sales && sale?.status === 'delivered' && !isAdmin;
  
  // Proposal CPEs and client CPEs
  const { data: proposalCpes = [] } = useProposalCpes(sale?.proposal_id ?? undefined);
  const updateProposalCpes = useUpdateProposalCpes();
  const clientIdForCpes = sale?.client_id || sale?.client?.id || null;
  const { data: clientCpes = [] } = useCpes(clientIdForCpes);
  const cpeLabel = isTelecom ? 'CPE/CUI (Pontos de Consumo)' : 'CPEs (Equipamentos)';
  const serialLabel = isTelecom ? 'Local de Consumo' : 'Nº Série';

  // Fiscal info
  const ixActive = isInvoiceXpressActive(organization);
  const orgTaxValue = getOrgTaxValue(organization);

  // Payment progress
  const { data: salePayments = [] } = useSalePayments(sale?.id);
  const paymentSummary = calculatePaymentSummary(salePayments, sale?.total_value || 0);
  
  // Form state
  const [clientId, setClientId] = useState<string>("");
  
  const [items, setItems] = useState<SaleItemDraft[]>([]);
  const [originalItemIds, setOriginalItemIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState<string>("0");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Energy/Service editable state
  const [negotiationType, setNegotiationType] = useState<string>("");
  const [consumoAnual, setConsumoAnual] = useState<string>("");
  const [margem, setMargem] = useState<string>("");
  const [dbl, setDbl] = useState<string>("");
  const [anosContrato, setAnosContrato] = useState<string>("");
  const [comissao, setComissao] = useState<string>("");
  const [modeloServico, setModeloServico] = useState<string>("");
  const [kwp, setKwp] = useState<string>("");
  const [servicosProdutos, setServicosProdutos] = useState<string[]>([]);
  const [servicosDetails, setServicosDetails] = useState<ServicosDetails>({});

  // Manual total value (for sales without items)
  const [manualTotalValue, setManualTotalValue] = useState<string>("");
  const [activationDate, setActivationDate] = useState<string>("");
  const [edpProposalNumber, setEdpProposalNumber] = useState<string>("");

  // Editable CPEs state
  const [editableCpes, setEditableCpes] = useState<CreateProposalCpeData[]>([]);

  // Initialize form with sale data
  useEffect(() => {
    if (open && sale) {
      setClientId(sale.client_id || "");
      setDiscount(sale.discount?.toString() || "0");
      setNotes(sale.notes || "");
      // Energy/Service fields
      setNegotiationType(sale.negotiation_type || "");
      setConsumoAnual(sale.consumo_anual?.toString() || "");
      setMargem(sale.margem?.toString() || "");
      setDbl(sale.dbl?.toString() || "");
      setAnosContrato(sale.anos_contrato?.toString() || "");
      setComissao(sale.comissao?.toString() || "");
      setModeloServico(sale.modelo_servico || "");
      setKwp(sale.kwp?.toString() || "");
      setServicosProdutos(sale.servicos_produtos || []);
      setServicosDetails((sale as any).servicos_details || {});
      setManualTotalValue(sale.total_value?.toString() || "0");
      setActivationDate(sale.activation_date || "");
      setEdpProposalNumber((sale as any).edp_proposal_number || "");
    }
  }, [open, sale]);

  // Keep stable refs for commission calculation to avoid re-triggering init
  const calcCommissionRef = useRef(calculateEnergyCommission);
  const hasEnergyConfigRef = useRef(hasEnergyConfig);
  calcCommissionRef.current = calculateEnergyCommission;
  hasEnergyConfigRef.current = hasEnergyConfig;

  // Initialize editable CPEs from proposalCpes with recalculated commissions
  useEffect(() => {
    if (open && proposalCpes.length > 0) {
      setEditableCpes(proposalCpes.map(cpe => {
        // Recalculate commission using current tier rules
        let comissao = cpe.comissao;
        if (hasEnergyConfigRef.current && cpe.margem && cpe.consumo_anual) {
          const margem = Number(cpe.margem);
          if (margem > 0) {
            const calc = calcCommissionRef.current(margem, getVolumeTier(Number(cpe.consumo_anual) || 0));
            if (calc !== null) comissao = calc;
          }
        }
        return {
          proposal_id: cpe.proposal_id,
          existing_cpe_id: cpe.existing_cpe_id,
          equipment_type: cpe.equipment_type,
          serial_number: cpe.serial_number,
          comercializador: cpe.comercializador,
          fidelizacao_start: cpe.fidelizacao_start,
          fidelizacao_end: cpe.fidelizacao_end,
          notes: cpe.notes,
          consumo_anual: cpe.consumo_anual,
          duracao_contrato: cpe.duracao_contrato,
          dbl: cpe.dbl,
          margem: cpe.margem,
          comissao,
          contrato_inicio: cpe.contrato_inicio,
          contrato_fim: cpe.contrato_fim,
        };
      }));
    } else if (open) {
      setEditableCpes([]);
    }
  }, [open, proposalCpes]);

  // Initialize items when existingItems load
  useEffect(() => {
    if (open && existingItems.length > 0) {
      const draftItems: SaleItemDraft[] = existingItems.map(item => ({
        id: crypto.randomUUID(),
        originalId: item.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        first_due_date: (item as any).first_due_date ? new Date((item as any).first_due_date) : null,
        isNew: false,
        isModified: false,
      }));
      setItems(draftItems);
      setOriginalItemIds(existingItems.map(i => i.id));
    } else if (open && existingItems.length === 0) {
      setItems([]);
      setOriginalItemIds([]);
    }
  }, [open, existingItems]);

  // Sync manualTotalValue when editable CPEs or comissao change (telecom sales)
  useEffect(() => {
    if (!open || !sale || !isTelecom) return;
    if (sale.proposal_type === 'energia' && editableCpes.length > 0) {
      const margemTotal = editableCpes.reduce((sum, cpe) => sum + (cpe.margem || 0), 0);
      setManualTotalValue(margemTotal.toString());
    } else if (sale.proposal_type === 'servicos' && comissao) {
      setManualTotalValue(comissao);
    }
  }, [open, sale, isTelecom, editableCpes, comissao]);

  // Auto-recalculate commission when relevant fields change (servicos only)
  useEffect(() => {
    if (!open || sale?.proposal_type !== 'servicos' || servicosProdutos.length === 0) return;
    
    let total = 0;
    let anyCalc = false;
    const kwpVal = parseFloat(kwp) || undefined;
    const valorVal = parseFloat(manualTotalValue) || undefined;
    const ms = (modeloServico as 'transacional' | 'saas') || undefined;
    
    for (const prodName of servicosProdutos) {
      const detail = { kwp: kwpVal, valor: valorVal };
      const calc = calculateCommission(prodName, detail, ms);
      if (calc !== null) {
        total += Math.round(calc * 100) / 100;
        anyCalc = true;
      }
    }
    
    if (anyCalc) {
      setComissao(total.toString());
    }
  }, [open, sale?.proposal_type, servicosProdutos, kwp, modeloServico, manualTotalValue, calculateCommission]);

  // Check if sale can be fully edited
  const canFullEdit = isAdmin || (sale?.status !== 'delivered' && sale?.status !== 'cancelled' && sale?.status !== 'fulfilled');

  // Client options
  const clientOptions: ComboboxOption[] = useMemo(() => {
    if (!clients) return [];
    return clients.map(c => ({
      value: c.id,
      label: c.name,
      subtitle: c.code || c.email || undefined,
    }));
  }, [clients]);

  // Product options
  const productOptions: ComboboxOption[] = useMemo(() => {
    if (!products) return [];
    const existingProductIds = items.map(i => i.product_id).filter(Boolean);
    return products
      .filter(p => p.is_active && !existingProductIds.includes(p.id))
      .map(p => ({
        value: p.id,
        label: p.name,
        subtitle: p.price ? formatCurrency(p.price) : undefined,
      }));
  }, [products, items]);

  // Calculate totals
  const hasItems = items.length > 0;
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [items]);

  const subtotal = hasItems ? itemsSubtotal : parseFloat(manualTotalValue) || 0;
  const discountValue = parseFloat(discount) || 0;
  const total = hasItems ? Math.max(0, subtotal - discountValue) : subtotal;

  // VAT calculation
  const vatCalc = useVatCalculation({
    items, products, orgTaxValue, discount: discountValue, subtotal,
  });

  // Selected client fiscal data
  const selectedClient = useMemo(() => {
    if (!clientId || !clients) return null;
    return clients.find(c => c.id === clientId) || null;
  }, [clientId, clients]);

  // Handlers
  const handleAddProduct = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    const existing = items.find(i => i.product_id === productId);
    if (existing) {
      setItems(items.map(i => 
        i.product_id === productId 
          ? { ...i, quantity: i.quantity + 1, isModified: !i.isNew }
          : i
      ));
    } else {
      setItems([...items, {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.price || 0,
        isNew: true,
      }]);
    }
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setItems(items.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty, isModified: !i.isNew };
      }
      return i;
    }));
  };

  const handleUpdatePrice = (itemId: string, price: string) => {
    setItems(items.map(i => {
      if (i.id === itemId) {
        return { ...i, unit_price: parseFloat(price) || 0, isModified: !i.isNew };
      }
      return i;
    }));
  };

  const handleUpdateName = (itemId: string, name: string) => {
    setItems(items.map(i => {
      if (i.id === itemId) {
        return { ...i, name, isModified: !i.isNew };
      }
      return i;
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const handleUpdateDueDate = (itemId: string, date: Date | undefined) => {
    setItems(items.map(i => 
      i.id === itemId 
        ? { ...i, first_due_date: date || null, isModified: !i.isNew }
        : i
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;
    
    setIsSubmitting(true);

    try {
      await updateSale.mutateAsync({
        saleId: sale.id,
        updates: {
          client_id: clientId || null,
          total_value: total,
          subtotal: subtotal,
          discount: discountValue,
          notes: notes.trim() || null,
          negotiation_type: negotiationType || null,
          consumo_anual: parseFloat(consumoAnual) || null,
          margem: parseFloat(margem) || null,
          dbl: parseFloat(dbl) || null,
          anos_contrato: parseInt(anosContrato) || null,
          comissao: parseFloat(comissao) || null,
          modelo_servico: (modeloServico as ModeloServico) || null,
          kwp: parseFloat(kwp) || null,
          servicos_produtos: servicosProdutos.length > 0 ? servicosProdutos : null,
          servicos_details: Object.keys(servicosDetails).length > 0 ? servicosDetails : null,
          ...(isTelecom ? { activation_date: activationDate || null } : {}),
          ...(saleFields?.edp_proposal_number?.visible ? { edp_proposal_number: edpProposalNumber.trim() || null } : {}),
        },
      });

      // Save CPE changes if proposal exists
      if (sale.proposal_id && editableCpes.length > 0) {
        await updateProposalCpes.mutateAsync({
          proposalId: sale.proposal_id,
          cpes: editableCpes,
        });
      }

      const currentItemOriginalIds = items
        .filter(i => i.originalId)
        .map(i => i.originalId!);
      
      const itemsToDelete = originalItemIds.filter(
        id => !currentItemOriginalIds.includes(id)
      );
      const itemsToUpdate = items.filter(i => i.originalId && i.isModified);
      const itemsToCreate = items.filter(i => i.isNew);

      await Promise.all(
        itemsToDelete.map(id => 
          deleteSaleItem.mutateAsync({ itemId: id, saleId: sale.id })
        )
      );

      await Promise.all(
        itemsToUpdate.map(item => 
          updateSaleItem.mutateAsync({
            itemId: item.originalId!,
            saleId: sale.id,
            updates: {
              name: item.name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
              first_due_date: item.first_due_date 
                ? format(item.first_due_date, 'yyyy-MM-dd') 
                : null,
            },
          })
        )
      );

      if (itemsToCreate.length > 0) {
        await createSaleItems.mutateAsync(
          itemsToCreate.map(item => ({
            sale_id: sale.id,
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
            first_due_date: item.first_due_date 
              ? format(item.first_due_date, 'yyyy-MM-dd') 
              : null,
          }))
        );
        
        if (organization && sale.status === 'delivered') {
          const recurringNewItemsWithDate = itemsToCreate.filter(item => {
            if (!item.product_id) return false;
            const product = products?.find(p => p.id === item.product_id);
            return product?.is_recurring && item.first_due_date;
          });
          
          for (const item of recurringNewItemsWithDate) {
            await createSalePayment.mutateAsync({
              sale_id: sale.id,
              organization_id: organization.id,
              amount: item.quantity * item.unit_price,
              payment_date: format(item.first_due_date!, 'yyyy-MM-dd'),
              status: 'pending',
              notes: `Mensalidade: ${item.name}`,
            });
          }
        }
      }

      if (organization && sale.status === 'delivered') {
        for (const item of items) {
          if (item.originalId && !item.isNew) {
            const product = products?.find(p => p.id === item.product_id);
            if (product?.is_recurring && item.first_due_date) {
              const paymentDateStr = format(item.first_due_date, 'yyyy-MM-dd');
              
              const { data: existingPayments } = await supabase
                .from('sale_payments')
                .select('id')
                .eq('sale_id', sale.id)
                .eq('payment_date', paymentDateStr)
                .eq('status', 'pending');
              
              if (!existingPayments || existingPayments.length === 0) {
                await createSalePayment.mutateAsync({
                  sale_id: sale.id,
                  organization_id: organization.id,
                  amount: item.quantity * item.unit_price,
                  payment_date: paymentDateStr,
                  status: 'pending',
                  notes: `Mensalidade: ${item.name}`,
                });
              }
            }
          }
        }
      }

      toast.success("Venda atualizada com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating sale:", error);
      toast.error("Erro ao atualizar venda");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="fullScreen" className="flex flex-col p-0 gap-0">
        <DialogHeader className="pl-6 pr-14 py-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Editar Venda
            {sale.code && (
              <Badge variant="outline" className="font-mono text-xs">
                {sale.code}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* LEFT COLUMN (60%) */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Dados da Venda */}
                  <Card>
                    <CardHeader className="pb-2 p-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        Dados da Venda
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Código</Label>
                          <p className="font-mono text-sm font-medium">{sale.code || '—'}</p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Data da Venda</Label>
                          <p className="text-sm font-medium">
                            {format(new Date(sale.sale_date), "d MMM yyyy", { locale: pt })}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Estado</Label>
                          <div>
                            <Badge className={cn("text-xs", SALE_STATUS_COLORS[sale.status])}>
                              {SALE_STATUS_LABELS[sale.status]}
                            </Badge>
                          </div>
                        </div>
                        {isTelecom && (sale.status === 'fulfilled' || sale.status === 'delivered' || sale.status === 'in_progress') && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Data de Ativação</Label>
                            <Input
                              type="date"
                              value={activationDate}
                              onChange={(e) => setActivationDate(e.target.value)}
                              className="h-9"
                              disabled={isDeliveredLocked}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Client */}
                  <Card>
                    <CardHeader className="pb-2 p-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        Informação Básica
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="space-y-2">
                        <Label>Cliente</Label>
                        <SearchableCombobox
                          options={clientOptions}
                          value={clientId}
                          onValueChange={setClientId}
                          placeholder="Selecionar cliente..."
                          searchPlaceholder="Pesquisar cliente..."
                          emptyText="Nenhum cliente encontrado"
                          disabled={!canFullEdit}
                        />
                      </div>

                      {/* Client Fiscal Card */}
                      {clientId && (
                        <ClientFiscalCard client={selectedClient} isInvoiceXpressActive={ixActive} />
                      )}
                    </CardContent>
                  </Card>

                  {/* Proposal info (read-only) */}
                  {sale.proposal && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Proposta associada:</span>
                          {sale.proposal.code && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {sale.proposal.code}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Energy Data (editable) */}
                  {showEnergy && sale?.proposal_type === 'energia' && (
                    <Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Dados de Energia
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Tipo de Negociação</Label>
                            <Select value={negotiationType} onValueChange={setNegotiationType}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                              <SelectContent>
                                {NEGOTIATION_TYPES.map(t => (<SelectItem key={t} value={t}>{NEGOTIATION_TYPE_LABELS[t]}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Consumo Anual (kWh)</Label>
                            <Input type="number" value={consumoAnual} onChange={e => setConsumoAnual(e.target.value)} className="h-9" step="0.01" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Margem (€/MWh)</Label>
                            <Input type="number" value={margem} onChange={e => setMargem(e.target.value)} className="h-9" step="0.01" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Anos de Contrato (auto)</Label>
                            <Input type="number" value={anosContrato} className="h-9 bg-muted" step="1" min="0" disabled />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">DBL</Label>
                            <Input type="number" value={dbl} onChange={e => setDbl(e.target.value)} className="h-9" step="0.01" />
                          </div>
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Comissão (€)</Label>
                            <Input type="number" value={comissao} onChange={e => setComissao(e.target.value)} className="h-9" step="0.01" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Service Data (editable) - new catalog format */}
                  {isTelecom && isNewFormat && catalog && (sale?.proposal_type === 'servicos' || !sale?.proposal_type) && (
                    <Card>
                      <CardContent className="p-4">
                        <ServicosSection
                          hideModeloServico
                          modeloServico={(modeloServico as 'transacional' | 'saas') || 'transacional'}
                          onModeloServicoChange={(v) => setModeloServico(v)}
                          servicosProdutos={servicosProdutos}
                          servicosDetails={servicosDetails}
                          isNewFormat={isNewFormat}
                          catalog={catalog}
                          configs={SERVICOS_PRODUCT_CONFIGS}
                          onToggleProduct={(name) => {
                            if (servicosProdutos.includes(name)) {
                              setServicosProdutos(prev => prev.filter(p => p !== name));
                              setServicosDetails(prev => {
                                const next = { ...prev };
                                delete next[name];
                                return next;
                              });
                            } else {
                              setServicosProdutos(prev => [...prev, name]);
                              const catProduct = catalog?.find(c => c.name === name);
                              if (catProduct) {
                                const comissaoVal = catProduct.has_commission ? Math.round(catProduct.price * catProduct.commission_pct) / 100 : 0;
                                setServicosDetails(prev => ({
                                  ...prev,
                                  [name]: {
                                    price: catProduct.price,
                                    commission_pct: catProduct.commission_pct,
                                    comissao: comissaoVal,
                                  },
                                }));
                              }
                            }
                          }}
                          onUpdateDetail={() => {}}
                          onSetProductDetail={(product, detail) => {
                            setServicosDetails(prev => ({ ...prev, [product]: detail }));
                          }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Service Data (editable) - legacy format */}
                  {isTelecom && !isNewFormat && sale?.proposal_type === 'servicos' && (
                    <Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Wrench className="h-4 w-4 text-blue-500" />
                          Dados do Serviço
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Tipo de Negociação</Label>
                            <Select value={negotiationType} onValueChange={setNegotiationType}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                              <SelectContent>
                                {NEGOTIATION_TYPES.map(t => (<SelectItem key={t} value={t}>{NEGOTIATION_TYPE_LABELS[t]}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Serviços/Produtos</Label>
                            <div className="flex flex-wrap gap-3 mt-1">
                              {catalogProductNames.map(sp => (
                                <label key={sp} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox checked={servicosProdutos.includes(sp)} onCheckedChange={(checked) => { if (checked) { setServicosProdutos(prev => [...prev, sp]); } else { setServicosProdutos(prev => prev.filter(s => s !== sp)); } }} />
                                  {sp}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Modelo de Serviço</Label>
                            <Select value={modeloServico} onValueChange={setModeloServico}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="transacional">Transacional</SelectItem>
                                <SelectItem value="saas">SAAS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">kWp</Label>
                            <Input type="number" value={kwp} onChange={e => setKwp(e.target.value)} className="h-9" step="0.01" />
                          </div>
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              Comissão (€)
                              {servicosProdutos.some(p => isAutoCalculated(p)) && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">Auto</Badge>
                              )}
                            </Label>
                            <Input 
                              type="number" 
                              value={comissao} 
                              onChange={e => setComissao(e.target.value)} 
                              className="h-9" 
                              step="0.01"
                              readOnly={servicosProdutos.some(p => isAutoCalculated(p))}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* CPEs (editable) */}
                  {isTelecom && editableCpes.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Zap className="h-4 w-4 text-amber-500" />
                          {cpeLabel}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-3">
                        {editableCpes.map((cpe, idx) => (
                          <div key={idx} className="p-3 rounded-lg border bg-muted/30 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{cpe.equipment_type}</Badge>
                              {negotiationType === 'renovacao' ? (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">Renovação</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">Novo</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Comercializador</Label>
                                <Input value={cpe.comercializador} onChange={e => { const u = [...editableCpes]; u[idx] = { ...u[idx], comercializador: e.target.value }; setEditableCpes(u); }} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{serialLabel}</Label>
                                <Input value={cpe.serial_number || ""} onChange={e => { const u = [...editableCpes]; u[idx] = { ...u[idx], serial_number: e.target.value }; setEditableCpes(u); }} className="h-8 text-sm font-mono" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Início Contrato</Label>
                                <Input type="date" value={cpe.contrato_inicio || ""} onChange={e => {
                                  const u = [...editableCpes];
                                  const inicio = e.target.value;
                                  const fim = u[idx].contrato_fim;
                                  let duracao = u[idx].duracao_contrato;
                                  if (inicio && fim) {
                                    const days = (new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000;
                                    duracao = days > 0 ? parseFloat((days / 365).toFixed(3)) : null;
                                  }
                                  u[idx] = { ...u[idx], contrato_inicio: inicio || null, duracao_contrato: duracao };
                                  setEditableCpes(u);
                                }} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Fim Contrato</Label>
                                <Input type="date" value={cpe.contrato_fim || ""} onChange={e => {
                                  const u = [...editableCpes];
                                  const fim = e.target.value;
                                  const inicio = u[idx].contrato_inicio;
                                  let duracao = u[idx].duracao_contrato;
                                  if (inicio && fim) {
                                    const days = (new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000;
                                    duracao = days > 0 ? parseFloat((days / 365).toFixed(3)) : null;
                                  }
                                  u[idx] = { ...u[idx], contrato_fim: fim || null, duracao_contrato: duracao };
                                  setEditableCpes(u);
                                }} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Duração (anos)</Label>
                                <Input type="number" value={cpe.duracao_contrato ?? ""} className="h-8 text-sm bg-muted" disabled />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Consumo (kWh)</Label>
                                <Input type="number" value={cpe.consumo_anual ?? ""} onChange={e => {
                                  const u = [...editableCpes];
                                  const newConsumo = e.target.value ? parseFloat(e.target.value) : null;
                                  const currentMargem = u[idx].margem ?? 0;
                                  let newComissao = u[idx].comissao;
                                  if (hasEnergyConfigRef.current && currentMargem > 0) {
                                    const calc = calcCommissionRef.current(currentMargem, getVolumeTier(newConsumo || 0));
                                    if (calc !== null) newComissao = parseFloat(calc.toFixed(2));
                                  }
                                  u[idx] = { ...u[idx], consumo_anual: newConsumo, comissao: newComissao };
                                  setEditableCpes(u);
                                }} className="h-8 text-sm" step="0.01" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">DBL</Label>
                                <Input type="number" value={cpe.dbl ?? ""} onChange={e => { const u = [...editableCpes]; u[idx] = { ...u[idx], dbl: e.target.value ? parseFloat(e.target.value) : null }; setEditableCpes(u); }} className="h-8 text-sm" step="0.01" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Margem (€/MWh)</Label>
                                <Input type="number" value={cpe.margem ?? ""} onChange={e => {
                                  const u = [...editableCpes];
                                  const newMargem = e.target.value ? parseFloat(e.target.value) : null;
                                  const currentConsumo = u[idx].consumo_anual ?? 0;
                                  let newComissao = u[idx].comissao;
                                  if (hasEnergyConfigRef.current && newMargem && newMargem > 0) {
                                    const calc = calcCommissionRef.current(newMargem, getVolumeTier(currentConsumo));
                                    if (calc !== null) newComissao = parseFloat(calc.toFixed(2));
                                  }
                                  u[idx] = { ...u[idx], margem: newMargem, comissao: newComissao };
                                  setEditableCpes(u);
                                }} className="h-8 text-sm" step="0.01" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Comissão (€)</Label>
                                <Input type="number" value={cpe.comissao ?? ""} onChange={e => { const u = [...editableCpes]; u[idx] = { ...u[idx], comissao: e.target.value ? parseFloat(e.target.value) : null }; setEditableCpes(u); }} className="h-8 text-sm" step="0.01" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Client CPEs (read-only, no proposal) */}
                  {isTelecom && editableCpes.length === 0 && clientCpes.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Zap className="h-4 w-4 text-amber-500" />
                          {cpeLabel}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2">
                        {clientCpes.map((cpe) => {
                          const statusStyle = CPE_STATUS_STYLES[cpe.status as keyof typeof CPE_STATUS_STYLES];
                          return (
                            <div key={cpe.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">{cpe.equipment_type}</Badge>
                                <Badge variant="secondary" className="text-xs">{cpe.comercializador}</Badge>
                                {statusStyle && (
                                  <Badge variant="outline" className={`text-xs ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    {CPE_STATUS_LABELS[cpe.status as keyof typeof CPE_STATUS_LABELS]}
                                  </Badge>
                                )}
                              </div>
                              {cpe.serial_number && (
                                <div>
                                  <p className="text-xs text-muted-foreground">{serialLabel}</p>
                                  <p className="text-sm font-mono">{cpe.serial_number}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {canFullEdit && !isTelecom && (
                    <Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          Produtos/Serviços
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-3">
                        {items.length > 0 && (
                          <div className="space-y-2">
                            {items.map((item) => {
                              const product = products?.find(p => p.id === item.product_id);
                              const isRecurring = product?.is_recurring;
                              
                              return (
                                <div
                                  key={item.id}
                                  className="p-3 rounded-lg border bg-card space-y-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          value={item.name}
                                          onChange={(e) => handleUpdateName(item.id, e.target.value)}
                                          className="h-8 text-sm font-medium"
                                        />
                                        {ixActive && <VatBadge taxValue={vatCalc.getItemTaxRate(item.product_id)} />}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, -1)}>
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, 1)}>
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>

                                    <div className="w-24">
                                      <Input
                                        type="number"
                                        value={item.unit_price}
                                        onChange={(e) => handleUpdatePrice(item.id, e.target.value)}
                                        className="h-8 text-sm text-right"
                                        step="0.01"
                                        min="0"
                                      />
                                    </div>

                                    <div className="w-20 text-right text-sm font-medium">
                                      {formatCurrency(item.quantity * item.unit_price)}
                                    </div>

                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  
                                  {isRecurring && (
                                    <div className="flex items-center gap-2 pl-2 text-sm border-t pt-2 mt-2">
                                      <CalendarIcon className="h-4 w-4 text-primary" />
                                      <span className="text-muted-foreground">Vence em:</span>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                                            {item.first_due_date ? format(item.first_due_date, "dd/MM/yyyy") : "Selecionar data"}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={item.first_due_date || undefined}
                                            onSelect={(date) => handleUpdateDueDate(item.id, date)}
                                            locale={pt}
                                            className="pointer-events-auto"
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <Badge variant="secondary" className="text-xs">
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Mensal
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <SearchableCombobox
                          options={productOptions}
                          value=""
                          onValueChange={handleAddProduct}
                          placeholder="+ Adicionar produto..."
                          searchPlaceholder="Pesquisar produto..."
                          emptyText="Nenhum produto encontrado"
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Payments */}
                  {organization && !isTelecom && (
                    <Card>
                      <CardContent className="p-4">
                        <SalePaymentsList
                          saleId={sale.id}
                          organizationId={organization.id}
                          saleTotal={total}
                          readonly={!canFullEdit && sale.status === 'cancelled'}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Recurring Section */}
                  {sale.has_recurring && organization && (
                    <Card>
                      <CardContent className="p-4">
                        <RecurringSection
                          saleId={sale.id}
                          organizationId={organization.id}
                          recurringValue={sale.recurring_value || 0}
                          recurringStatus={sale.recurring_status || null}
                          nextRenewalDate={sale.next_renewal_date || null}
                          lastRenewalDate={sale.last_renewal_date || null}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* RIGHT COLUMN (40%) - Sticky */}
                <div className="lg:col-span-2">
                  <div className="lg:sticky lg:top-6 space-y-4">
                    {/* Summary Card */}
                    {canFullEdit && (
                      <Card>
                        <CardHeader className="pb-2 p-4">
                          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            Resumo
                          </CardTitle>
                        </CardHeader>
                         <CardContent className="p-4 pt-0 space-y-3">
                          {!hasItems ? (
                            <div className="space-y-1.5">
                              <Label className="text-sm text-muted-foreground">Valor Total</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">€</span>
                                <Input
                                  type="number"
                                  value={manualTotalValue}
                                  onChange={(e) => setManualTotalValue(e.target.value)}
                                  className="h-8 text-right"
                                  step="0.01"
                                  min="0"
                                  readOnly={isTelecom}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>{formatCurrency(subtotal)}</span>
                            </div>
                          )}
                          
                          {hasItems && (
                            <div className="flex items-center justify-between gap-4">
                              <Label className="text-sm text-muted-foreground">Desconto</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">€</span>
                                <Input
                                  type="number"
                                  value={discount}
                                  onChange={(e) => setDiscount(e.target.value)}
                                  className="w-24 h-8 text-right"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                            </div>
                          )}
                          
                          <Separator />

                          {ixActive && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">IVA</span>
                              <span className="font-medium">{formatCurrency(vatCalc.totalVat)}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between text-lg font-semibold">
                            <span>{ixActive ? 'Total (s/ IVA)' : 'Total'}</span>
                            <span className="text-primary">{formatCurrency(total)}</span>
                          </div>

                          {ixActive && (
                            <div className="flex justify-between text-sm border-t pt-2">
                              <span className="text-muted-foreground font-medium">Total c/ IVA</span>
                              <span className="font-semibold">{formatCurrency(vatCalc.totalWithVat)}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Payment Progress */}
                    {organization?.niche !== 'telecom' && salePayments.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2 p-4">
                          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <CreditCard className="h-4 w-4" />
                            Pagamento
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progresso</span>
                              <span>{Math.round(paymentSummary.percentage)}%</span>
                            </div>
                            <Progress value={paymentSummary.percentage} className="h-2" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Pago</p>
                              <p className="text-sm font-semibold text-green-500">{formatCurrency(paymentSummary.totalPaid)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Em Falta</p>
                              <p className="text-sm font-semibold text-amber-500">{formatCurrency(paymentSummary.remaining)}</p>
                            </div>
                          </div>
                          {paymentSummary.totalScheduled > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">Agendado</p>
                              <p className="text-sm font-semibold">{formatCurrency(paymentSummary.totalScheduled)}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Notes */}
                    {/* EDP Proposal Number */}
                    {saleFields?.edp_proposal_number?.visible && (<Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {saleFields.edp_proposal_number.label}{saleFields.edp_proposal_number.required ? ' *' : ''}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <Input
                          placeholder="Ex: EDP-2024-001234"
                          value={edpProposalNumber}
                          onChange={(e) => setEdpProposalNumber(e.target.value)}
                          required={saleFields.edp_proposal_number.required}
                        />
                    </CardContent>
                    </Card>)}

                    <Card>
                      <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Notas</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <Textarea
                          placeholder="Observações sobre a venda..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="min-h-[60px]"
                        />
                      </CardContent>
                    </Card>

                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-4 border-t border-border/50 shrink-0">
            {isDeliveredLocked && (
              <div className="flex items-center gap-2 text-amber-500 text-sm mb-3 max-w-6xl mx-auto">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Esta venda está concluída. Apenas administradores podem editar.</span>
              </div>
            )}
            <div className="flex gap-3 max-w-6xl mx-auto">
              <Button
                type="submit"
                variant="senvia"
                className="flex-1"
                size="lg"
                disabled={isSubmitting || isDeliveredLocked}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  "Guardar Alterações"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                size="lg"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
