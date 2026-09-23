import { useState, useEffect, useMemo } from 'react';
import { Layers3, Plus, X, Zap, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { calculateExactDuration, formatDurationBreakdown } from '@/lib/date-utils';
import { useCpes } from '@/hooks/useCpes';
import { ENERGY_COMERCIALIZADORES } from '@/types/cpes';
import type { CpeServiceType } from '@/types/cpes';
import { useCommissionMatrix, getVolumeTier } from '@/hooks/useCommissionMatrix';

export interface ProposalCpeDraft {
  id: string;
  existing_cpe_id: string | null;
  equipment_type: string;
  serial_number: string;
  comercializador: string;
  fidelizacao_start: string;
  fidelizacao_end: string;
  notes: string;
  isNew: boolean;
  // Dados de energia por CPE
  consumo_anual: string;
  duracao_contrato: string;
  dbl: string;
  margem: string;
  comissao: string;
  /** Same key on all CPEs that share a single commission calculation. */
  commission_group_key?: string | null;
  /** Kept on every draft only for rendering; persisted once in the group header. */
  commission_group_comissao?: string;
  contrato_inicio: string;
  contrato_fim: string;
  service_type: CpeServiceType | null;
  modalidade: string;
  kwp: string;
}

interface ProposalCpeSelectorProps {
  clientId: string | null;
  cpes: ProposalCpeDraft[];
  onCpesChange: (cpes: ProposalCpeDraft[]) => void;
}

// Calcula margem: consumo × duração × DBL / 1000
function calculateMargem(consumo: string, duracao: string, dbl: string): string {
  const c = parseFloat(consumo) || 0;
  const d = parseFloat(duracao) || 0;
  const db = parseFloat(dbl) || 0;
  if (c > 0 && d > 0 && db > 0) {
    return ((c * d * db) / 1000).toFixed(2);
  }
  return '';
}

export function getProposalCpeDraftCommissionGroups(cpes: ProposalCpeDraft[]) {
  const seen = new Set<string>();
  return cpes.flatMap(cpe => {
    if (!cpe.commission_group_key) return [];
    if (seen.has(cpe.commission_group_key)) return [];
    seen.add(cpe.commission_group_key);
    return [{
      source_id: cpe.commission_group_key,
      total_comissao: Number(cpe.commission_group_comissao || 0),
    }];
  });
}

export function getProposalCpeDraftTotalCommission(cpes: ProposalCpeDraft[]) {
  const grouped = getProposalCpeDraftCommissionGroups(cpes)
    .reduce((sum, group) => sum + group.total_comissao, 0);
  const legacy = cpes
    .filter(cpe => !cpe.commission_group_key)
    .reduce((sum, cpe) => sum + (Number(cpe.comissao) || 0), 0);
  return grouped + legacy;
}

export function ProposalCpeSelector({ clientId, cpes, onCpesChange }: ProposalCpeSelectorProps) {
  const { data: clientCpes = [] } = useCpes(clientId);
  const { calculateEnergyCommission, hasEnergyConfig } = useCommissionMatrix();
  
  const comercializadorOptions = ENERGY_COMERCIALIZADORES;
  
  // State for existing CPE selection form
  const [selectedExistingCpeIds, setSelectedExistingCpeIds] = useState<string[]>([]);
  const [requestedCpeQuantity, setRequestedCpeQuantity] = useState('1');
  const [updateConsumoAnual, setUpdateConsumoAnual] = useState('');
  const [updateDuracaoContrato, setUpdateDuracaoContrato] = useState('');
  const [updateDbl, setUpdateDbl] = useState('');
  const [updateComissao, setUpdateComissao] = useState('');
  const [updateContratoInicio, setUpdateContratoInicio] = useState('');
  const [updateContratoFim, setUpdateContratoFim] = useState('');
  const [updateComercializador, setUpdateComercializador] = useState('');
  const [updateCustomComercializador, setUpdateCustomComercializador] = useState('');

  // Auto-calculate margem for existing CPE
  const updateMargem = useMemo(() => 
    calculateMargem(updateConsumoAnual, updateDuracaoContrato, updateDbl), 
    [updateConsumoAnual, updateDuracaoContrato, updateDbl]
  );

  // Auto-calculate commission from energy config
  const updateAutoComissao = useMemo(() => {
    if (!hasEnergyConfig || !updateMargem) return null;
    const margem = parseFloat(updateMargem);
    if (margem <= 0) return null;
    return calculateEnergyCommission(margem, getVolumeTier(parseFloat(updateConsumoAnual) || 0));
  }, [updateMargem, hasEnergyConfig, calculateEnergyCommission]);

  // When auto-commission changes, update the field
  useEffect(() => {
    if (updateAutoComissao !== null) {
      setUpdateComissao(updateAutoComissao.toFixed(2));
    }
  }, [updateAutoComissao]);

  // Auto-calculate duracao when dates change
  useEffect(() => {
    if (updateContratoInicio && updateContratoFim) {
      const dur = calculateExactDuration(updateContratoInicio, updateContratoFim);
      if (dur > 0) {
        setUpdateDuracaoContrato(dur.toString());
      } else {
        setUpdateDuracaoContrato('');
      }
    } else {
      setUpdateDuracaoContrato('');
    }
  }, [updateContratoInicio, updateContratoFim]);

  const resetForm = () => {
    setSelectedExistingCpeIds([]);
    setRequestedCpeQuantity('1');
    setUpdateConsumoAnual('');
    setUpdateDuracaoContrato('');
    setUpdateDbl('');
    setUpdateComissao('');
    setUpdateContratoInicio('');
    setUpdateContratoFim('');
    setUpdateComercializador('');
    setUpdateCustomComercializador('');
  };

  const handleAddExistingCpe = () => {
    if (selectedExistingCpeIds.length === 0) return;

    const finalComercializador = updateComercializador === 'other' 
      ? updateCustomComercializador 
      : (updateComercializador === 'keep_current' || !updateComercializador ? existingCpe.comercializador : updateComercializador);

    const commissionGroupKey = crypto.randomUUID();
    const newCpes = selectedExistingCpeIds
      .map(id => clientCpes.find(cpe => cpe.id === id))
      .filter((cpe): cpe is NonNullable<typeof cpe> => !!cpe)
      .map((existingCpe, index): ProposalCpeDraft => ({
        id: crypto.randomUUID(),
        existing_cpe_id: existingCpe.id,
        equipment_type: existingCpe.equipment_type,
        serial_number: existingCpe.serial_number || '',
        comercializador: finalComercializador,
        fidelizacao_start: updateContratoInicio || existingCpe.fidelizacao_start || '',
        fidelizacao_end: updateContratoFim || existingCpe.fidelizacao_end || '',
        notes: '',
        isNew: false,
        consumo_anual: updateConsumoAnual,
        duracao_contrato: updateDuracaoContrato,
        dbl: updateDbl,
        margem: updateMargem,
        // The database keeps this value on one technical anchor CPE only so
        // older totals remain correct. The UI always presents it as a group.
        comissao: index === 0 ? updateComissao : '0',
        commission_group_key: commissionGroupKey,
        commission_group_comissao: updateComissao,
        contrato_inicio: updateContratoInicio,
        contrato_fim: updateContratoFim,
        service_type: existingCpe.service_type || (existingCpe.equipment_type === 'Gás' ? 'gas' : existingCpe.equipment_type === 'Energia' ? 'energia' : null),
        modalidade: existingCpe.modalidade || '',
        kwp: existingCpe.kwp != null ? String(existingCpe.kwp) : '',
      }));

    onCpesChange([...cpes, ...newCpes]);
    resetForm();
  };

  const handleRemoveCpe = (id: string) => {
    onCpesChange(cpes.filter(c => c.id !== id));
  };

  const handleUpdateCpeField = (id: string, field: keyof ProposalCpeDraft, value: string) => {
    onCpesChange(cpes.map(cpe => {
      if (cpe.id !== id) return cpe;
      const updated = { ...cpe, [field]: value };
      // Auto-recalculate margem when relevant fields change
      if (['consumo_anual', 'duracao_contrato', 'dbl'].includes(field)) {
        updated.margem = calculateMargem(updated.consumo_anual, updated.duracao_contrato, updated.dbl);
        // Auto-calculate commission from energy config
        if (hasEnergyConfig && updated.margem) {
          const margem = parseFloat(updated.margem);
          if (margem > 0) {
            const com = calculateEnergyCommission(margem, getVolumeTier(parseFloat(updated.consumo_anual) || 0));
            if (com !== null) updated.comissao = com.toFixed(2);
          }
        }
      }
      // Auto-recalculate duracao_contrato when dates change
      if ((field === 'contrato_inicio' || field === 'contrato_fim') && updated.contrato_inicio && updated.contrato_fim) {
        const dur = calculateExactDuration(updated.contrato_inicio, updated.contrato_fim);
        if (dur > 0) {
          updated.duracao_contrato = dur.toString();
          updated.margem = calculateMargem(updated.consumo_anual, updated.duracao_contrato, updated.dbl);
          // Auto-calculate commission
          if (hasEnergyConfig && updated.margem) {
            const margem = parseFloat(updated.margem);
            if (margem > 0) {
              const com = calculateEnergyCommission(margem, getVolumeTier(parseFloat(updated.consumo_anual) || 0));
              if (com !== null) updated.comissao = com.toFixed(2);
            }
          }
        }
      }
      return updated;
    }));
  };

  const handleUpdateGroupField = (groupKey: string, field: keyof ProposalCpeDraft, value: string) => {
    const group = cpes.filter(cpe => cpe.commission_group_key === groupKey);
    const source = group[0];
    if (!source) return;

    const next = { ...source, [field]: value };
    if ((field === 'contrato_inicio' || field === 'contrato_fim') && next.contrato_inicio && next.contrato_fim) {
      const duration = calculateExactDuration(next.contrato_inicio, next.contrato_fim);
      next.duracao_contrato = duration > 0 ? duration.toString() : '';
    }
    if (['consumo_anual', 'duracao_contrato', 'dbl', 'contrato_inicio', 'contrato_fim'].includes(field)) {
      next.margem = calculateMargem(next.consumo_anual, next.duracao_contrato, next.dbl);
      if (hasEnergyConfig && next.margem) {
        const calculated = calculateEnergyCommission(Number(next.margem), getVolumeTier(Number(next.consumo_anual) || 0));
        if (calculated !== null) next.commission_group_comissao = calculated.toFixed(2);
      }
    }
    if (field === 'commission_group_comissao') next.commission_group_comissao = value;

    const groupCommission = next.commission_group_comissao || '';
    onCpesChange(cpes.map(cpe => {
      if (cpe.commission_group_key !== groupKey) return cpe;
      return {
        ...cpe,
        comercializador: next.comercializador,
        consumo_anual: next.consumo_anual,
        duracao_contrato: next.duracao_contrato,
        dbl: next.dbl,
        margem: next.margem,
        contrato_inicio: next.contrato_inicio,
        contrato_fim: next.contrato_fim,
        fidelizacao_start: next.contrato_inicio,
        fidelizacao_end: next.contrato_fim,
        commission_group_comissao: groupCommission,
        comissao: cpe.id === group[0].id ? groupCommission : '0',
      };
    }));
  };

  // Filter out already selected CPEs from the list
  const availableExistingCpes = clientCpes.filter(
    cpe => !cpes.find(c => c.existing_cpe_id === cpe.id)
  );
  const requestedQuantity = Math.max(1, Math.min(availableExistingCpes.length || 1, Number(requestedCpeQuantity) || 1));

  const hasValidComercializador = updateComercializador === 'other' 
    ? !!updateCustomComercializador.trim() 
    : (!!updateComercializador && updateComercializador !== '');

  const canAddExisting = selectedExistingCpeIds.length === requestedQuantity
    && !!updateConsumoAnual
    && !!updateDuracaoContrato
    && !!updateDbl
    && !!updateComissao
    && !!updateContratoInicio
    && !!updateContratoFim
    && hasValidComercializador;

  const groupedCpes = useMemo(() => {
    const groups = new Map<string, ProposalCpeDraft[]>();
    cpes.forEach(cpe => {
      if (!cpe.commission_group_key) return;
      groups.set(cpe.commission_group_key, [...(groups.get(cpe.commission_group_key) || []), cpe]);
    });
    return [...groups.entries()].map(([key, items]) => ({ key, items, source: items[0] }));
  }, [cpes]);

  const toggleExistingCpe = (cpeId: string, checked: boolean) => {
    setSelectedExistingCpeIds(current => {
      if (!checked) return current.filter(id => id !== cpeId);
      if (current.length >= requestedQuantity) return current;
      return [...current, cpeId];
    });
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(num);
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Zap className="h-4 w-4" />
        CPE/CUI (Pontos de Consumo)
      </Label>

      {groupedCpes.length > 0 && (
        <div className="space-y-3">
          {groupedCpes.map(({ key, items, source }, index) => (
            <div key={key} className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                    <span className="text-sm font-semibold">Condições em lote #{index + 1}</span>
                    <Badge variant="outline" className="border-blue-300 bg-white/70 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200">{items.length} CPE{items.length === 1 ? '' : 's'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">O consumo indicado é repetido em cada CPE. A comissão pertence ao lote e é contabilizada uma única vez.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-destructive" onClick={() => onCpesChange(cpes.filter(cpe => cpe.commission_group_key !== key))}>
                  <X className="mr-1 h-4 w-4" />Remover lote
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {items.map(cpe => <Badge key={cpe.id} variant="secondary" className="max-w-full truncate font-mono text-[11px]">{cpe.serial_number || cpe.equipment_type}</Badge>)}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label className="text-xs">Comercializador</Label><Input value={source.comercializador} onChange={event => handleUpdateGroupField(key, 'comercializador', event.target.value)} className="h-9 bg-white/80 text-sm dark:bg-background" /></div>
                <div className="space-y-1"><Label className="text-xs">Início do contrato</Label><Input type="date" value={source.contrato_inicio} onChange={event => handleUpdateGroupField(key, 'contrato_inicio', event.target.value)} className="h-9 bg-white/80 text-sm dark:bg-background" /></div>
                <div className="space-y-1"><Label className="text-xs">Fim do contrato</Label><Input type="date" value={source.contrato_fim} onChange={event => handleUpdateGroupField(key, 'contrato_fim', event.target.value)} className="h-9 bg-white/80 text-sm dark:bg-background" /></div>
                <div className="space-y-1"><Label className="text-xs">Consumo anual por CPE (kWh)</Label><Input type="number" min="0" value={source.consumo_anual} onChange={event => handleUpdateGroupField(key, 'consumo_anual', event.target.value)} className="h-9 bg-white/80 text-sm dark:bg-background" /></div>
                <div className="space-y-1"><Label className="text-xs">DBL (€/MWh)</Label><Input type="number" step="0.01" min="0" value={source.dbl} onChange={event => handleUpdateGroupField(key, 'dbl', event.target.value)} className="h-9 bg-white/80 text-sm dark:bg-background" /></div>
                <div className="space-y-1"><Label className="text-xs">Duração</Label><Input value={source.duracao_contrato ? `${source.duracao_contrato} anos` : ''} disabled className="h-9 bg-white/60 text-sm dark:bg-background" placeholder="Automática" /></div>
              </div>
              <div className="mt-3 rounded-lg border border-blue-200 bg-white/75 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2"><Label className="text-xs font-semibold text-blue-900 dark:text-blue-100">Comissão única do lote (€){hasEnergyConfig ? <Badge variant="outline" className="ml-2 text-[9px]">Auto</Badge> : null}</Label><span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{formatCurrency(source.commission_group_comissao || '0')}</span></div>
                <Input type="number" step="0.01" min="0" value={source.commission_group_comissao || ''} onChange={event => handleUpdateGroupField(key, 'commission_group_comissao', event.target.value)} readOnly={hasEnergyConfig} className={`mt-2 h-9 bg-white text-sm dark:bg-background ${hasEnergyConfig ? 'opacity-80' : ''}`} placeholder="0,00" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List of added CPEs with energy data */}
      {cpes.length > 0 && (
        <div className="space-y-4">
          {cpes.filter(cpe => !cpe.commission_group_key).map((cpe, index) => (
            <div
              key={cpe.id}
              className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-sm">CPE/CUI #{index + 1}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveCpe(cpe.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* CPE basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Input
                    value={cpe.equipment_type}
                    className="h-8 text-sm"
                    disabled
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comercializador</Label>
                  <Input
                    value={cpe.comercializador}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'comercializador', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPE/CUI</Label>
                  <Input
                    value={cpe.serial_number}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'serial_number', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="PT0002..."
                  />
                </div>
              </div>

              <Separator className="my-3" />
              
              {/* Energy data per CPE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Consumo Anual (kWh)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={cpe.consumo_anual}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'consumo_anual', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="15000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Início Contrato</Label>
                  <Input
                    type="date"
                    value={cpe.contrato_inicio}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'contrato_inicio', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim Contrato</Label>
                  <Input
                    type="date"
                    value={cpe.contrato_fim}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'contrato_fim', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">DBL (€/MWh)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cpe.dbl}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'dbl', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="5.50"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Duração (anos)
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={cpe.duracao_contrato}
                    className="h-8 text-sm bg-muted font-medium"
                    disabled
                    placeholder="Auto"
                  />
                  {cpe.contrato_inicio && cpe.contrato_fim && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                      {formatDurationBreakdown(cpe.contrato_inicio, cpe.contrato_fim)}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Comissão (€)
                    {hasEnergyConfig && <Badge variant="outline" className="text-[9px] ml-1">Auto</Badge>}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cpe.comissao}
                    onChange={(e) => handleUpdateCpeField(cpe.id, 'comissao', e.target.value)}
                    className={`h-8 text-sm ${hasEnergyConfig ? 'bg-muted' : ''}`}
                    readOnly={hasEnergyConfig}
                    placeholder="150"
                  />
                </div>
              </div>

              {/* Summary */}
              {cpe.comissao && parseFloat(cpe.comissao) > 0 && (
                <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs text-amber-800 dark:text-amber-200">
                  Comissão calculada: <strong>{formatCurrency(cpe.comissao)}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add CPE from existing client CPEs */}
      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
        <Label className="text-sm font-medium">Selecionar CPE/CUI do Cliente</Label>
        
        {!clientId ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Selecione um cliente para ver os CPEs existentes
          </p>
        ) : clientCpes.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Este cliente não tem CPEs cadastrados.
            </p>
            <p className="text-xs text-muted-foreground">
              Adicione primeiro os pontos de consumo na ficha do cliente.
            </p>
          </div>
        ) : availableExistingCpes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todos os CPEs deste cliente já foram adicionados à proposta.
          </p>
        ) : (
          <>
            <div className="grid gap-3 rounded-lg border bg-background/70 p-3 sm:grid-cols-[150px_1fr]">
              <div className="space-y-1">
                <Label className="text-xs">Quantidade de CPEs</Label>
                <Input
                  type="number"
                  min="1"
                  max={availableExistingCpes.length}
                  value={requestedCpeQuantity}
                  onChange={(event) => {
                    const next = event.target.value;
                    setRequestedCpeQuantity(next);
                    const amount = Math.max(1, Number(next) || 1);
                    setSelectedExistingCpeIds(current => current.slice(0, amount));
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3"><Label className="text-xs">Selecionar os CPEs</Label><span className="text-[11px] text-muted-foreground">{selectedExistingCpeIds.length}/{requestedQuantity}</span></div>
                <div className="grid max-h-32 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                  {availableExistingCpes.map((cpe) => {
                    const checked = selectedExistingCpeIds.includes(cpe.id);
                    const limitReached = selectedExistingCpeIds.length >= requestedQuantity && !checked;
                    return (
                      <label key={cpe.id} className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors ${limitReached ? 'opacity-50' : 'hover:bg-muted'}`}>
                        <Checkbox checked={checked} disabled={limitReached} onCheckedChange={(value) => toggleExistingCpe(cpe.id, value === true)} />
                        <span className="truncate">{cpe.serial_number || cpe.equipment_type} <span className="text-muted-foreground">· {cpe.comercializador}</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedExistingCpeIds.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Novo Comercializador <span className="text-destructive">*</span></Label>
                    <Select value={updateComercializador} onValueChange={setUpdateComercializador}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Manter atual..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep_current">Manter atual</SelectItem>
                        {comercializadorOptions.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                        <SelectItem value="other">Outro...</SelectItem>
                      </SelectContent>
                    </Select>
                    {updateComercializador === 'other' && (
                      <Input
                        placeholder="Comercializador..."
                        value={updateCustomComercializador}
                        onChange={(e) => setUpdateCustomComercializador(e.target.value)}
                        className="h-8 mt-1"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Início Contrato <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={updateContratoInicio}
                      onChange={(e) => setUpdateContratoInicio(e.target.value)}
                      className="h-9"
                    />
                  </div>
                   <div className="space-y-1">
                    <Label className="text-xs">Fim Contrato <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={updateContratoFim}
                      onChange={(e) => setUpdateContratoFim(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <Separator />

                {/* Energy fields */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Consumo Anual (kWh) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={updateConsumoAnual}
                      onChange={(e) => setUpdateConsumoAnual(e.target.value)}
                      className="h-8"
                      placeholder="15000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">DBL (€/MWh) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={updateDbl}
                      onChange={(e) => setUpdateDbl(e.target.value)}
                      className="h-8"
                      placeholder="5.50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Calculator className="h-3 w-3" />
                      Duração (anos)
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      value={updateDuracaoContrato}
                      className="h-8 bg-muted font-medium"
                      disabled
                      placeholder="Auto"
                    />
                    {updateContratoInicio && updateContratoFim && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                        {formatDurationBreakdown(updateContratoInicio, updateContratoFim)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Comissão (€) <span className="text-destructive">*</span>
                    {hasEnergyConfig && <Badge variant="outline" className="text-[9px] ml-1">Auto</Badge>}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={updateComissao}
                    onChange={(e) => setUpdateComissao(e.target.value)}
                    className={`h-8 w-full sm:w-1/3 ${hasEnergyConfig ? 'bg-muted' : ''}`}
                    readOnly={hasEnergyConfig}
                    placeholder="150"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddExistingCpe}
                  disabled={!canAddExisting}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aplicar condições ao lote
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
