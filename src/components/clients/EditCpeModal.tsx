import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateCpe } from '@/hooks/useCpes';
import { EQUIPMENT_TYPES, COMERCIALIZADORES, ENERGY_TYPES, ENERGY_COMERCIALIZADORES, NIVEL_TENSAO_OPTIONS, type Cpe, type CpeStatus, type NivelTensao } from '@/types/cpes';

interface EditCpeModalProps {
  cpe: Cpe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTelecom?: boolean;
}

export function EditCpeModal({ cpe, open, onOpenChange, isTelecom = false }: EditCpeModalProps) {
  const updateCpe = useUpdateCpe();
  
  const [equipmentType, setEquipmentType] = useState('');
  const [customEquipmentType, setCustomEquipmentType] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [comercializador, setComercializador] = useState('');
  const [customComercializador, setCustomComercializador] = useState('');
  const [fidelizacaoStart, setFidelizacaoStart] = useState('');
  const [fidelizacaoEnd, setFidelizacaoEnd] = useState('');
  const [status, setStatus] = useState<CpeStatus>('active');
  const [nivelTensao, setNivelTensao] = useState<NivelTensao | ''>('');
  const [notes, setNotes] = useState('');
  
  // Conditional labels and options based on niche
  const typeLabel = isTelecom ? 'Tipo *' : 'Tipo de Equipamento *';
  const serialLabel = isTelecom ? 'Local de Consumo (CPE/CUI)' : 'Número de Série';
  const serialPlaceholder = isTelecom ? 'Ex: PT0002000012345678XX' : 'Ex: SN123456789';
  const typeOptions = isTelecom ? ENERGY_TYPES : EQUIPMENT_TYPES;
  const comercializadorOptions = isTelecom ? ENERGY_COMERCIALIZADORES : COMERCIALIZADORES;
  const modalTitle = isTelecom ? 'Editar CPE/CUI' : 'Editar CPE';
  const modalDescription = isTelecom 
    ? 'Atualize os dados do ponto de consumo.' 
    : 'Atualize os dados do equipamento.';

  useEffect(() => {
    if (cpe && open) {
      // Check if equipment type is in predefined list (use appropriate list based on niche)
      const typeList = isTelecom ? ENERGY_TYPES : EQUIPMENT_TYPES;
      if (typeList.includes(cpe.equipment_type)) {
        setEquipmentType(cpe.equipment_type);
        setCustomEquipmentType('');
      } else {
        setEquipmentType('Outro');
        setCustomEquipmentType(cpe.equipment_type);
      }

      // Check if comercializador is in predefined list
      const comercializadorList = isTelecom ? ENERGY_COMERCIALIZADORES : COMERCIALIZADORES;
      if (comercializadorList.includes(cpe.comercializador)) {
        setComercializador(cpe.comercializador);
        setCustomComercializador('');
      } else {
        setComercializador('Outro');
        setCustomComercializador(cpe.comercializador);
      }

      setSerialNumber(cpe.serial_number || '');
      setFidelizacaoStart(cpe.fidelizacao_start || '');
      setFidelizacaoEnd(cpe.fidelizacao_end || '');
      setStatus(cpe.status as CpeStatus);
      setNivelTensao((cpe.nivel_tensao as NivelTensao) || '');
      setNotes(cpe.notes || '');
    }
  }, [cpe, open, isTelecom]);

  const originalComercializador = cpe.comercializador;
  const comercializadorChanged = (() => {
    const finalCom = comercializador === 'Outro' ? customComercializador : comercializador;
    return finalCom !== originalComercializador;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalEquipmentType = equipmentType === 'Outro' ? customEquipmentType : equipmentType;
    const finalComercializador = comercializador === 'Outro' ? customComercializador : comercializador;

    if (!finalEquipmentType || !finalComercializador) return;
    if (comercializadorChanged && !fidelizacaoEnd) return;

    const updateData: Record<string, unknown> = {
      id: cpe.id,
      equipment_type: finalEquipmentType,
      serial_number: serialNumber || null,
      comercializador: finalComercializador,
      fidelizacao_start: fidelizacaoStart || null,
      fidelizacao_end: fidelizacaoEnd || null,
      status,
      nivel_tensao: isTelecom && nivelTensao ? nivelTensao : null,
      notes: notes || null,
    };

    // If comercializador changed, mark as switched and reset alerts
    if (comercializadorChanged) {
      updateData.renewal_status = 'switched';
      updateData.alert_30d_sent = false;
      updateData.alert_7d_sent = false;
    }

    updateCpe.mutate(updateData as any, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const isValid = (equipmentType === 'Outro' ? customEquipmentType : equipmentType) && 
                  (comercializador === 'Outro' ? customComercializador : comercializador) &&
                  (!comercializadorChanged || fidelizacaoEnd);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>
            {modalDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Equipment Type */}
          <div className="space-y-2">
            <Label>{typeLabel}</Label>
            <Select value={equipmentType} onValueChange={setEquipmentType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {equipmentType === 'Outro' && (
              <Input
                placeholder="Especifique o tipo"
                value={customEquipmentType}
                onChange={(e) => setCustomEquipmentType(e.target.value)}
              />
            )}
          </div>

          {/* Serial Number / CPE-CUI */}
          <div className="space-y-2">
            <Label>{serialLabel}</Label>
            <Input
              placeholder={serialPlaceholder}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>

          {/* Comercializador */}
          <div className="space-y-2">
            <Label>Comercializador *</Label>
            <Select value={comercializador} onValueChange={setComercializador}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o comercializador" />
              </SelectTrigger>
              <SelectContent>
                {comercializadorOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {comercializador === 'Outro' && (
              <Input
                placeholder="Nome do comercializador"
                value={customComercializador}
                onChange={(e) => setCustomComercializador(e.target.value)}
              />
            )}
          </div>

          {/* Warning when comercializador changed */}
          {comercializadorChanged && (
            <div className="rounded-md bg-warning/10 border border-warning/20 p-3 text-xs text-warning">
              ⚠️ Ao alterar o comercializador, é obrigatório definir a nova data de fim de fidelização.
            </div>
          )}

          {/* Fidelização */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início Fidelização</Label>
              <Input
                type="date"
                value={fidelizacaoStart}
                onChange={(e) => setFidelizacaoStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim Fidelização {comercializadorChanged ? '*' : ''}</Label>
              <Input
                type="date"
                value={fidelizacaoEnd}
                onChange={(e) => setFidelizacaoEnd(e.target.value)}
                required={comercializadorChanged}
              />
            </div>
          </div>

          {/* Status or Nivel Tensão */}
          {isTelecom ? (
            <div className="space-y-2">
              <Label>Nível Tensão</Label>
              <Select value={nivelTensao} onValueChange={(v) => setNivelTensao(v as NivelTensao)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {NIVEL_TENSAO_OPTIONS.map((nt) => (
                    <SelectItem key={nt} value={nt}>{nt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CpeStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="returned">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Observações sobre o equipamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || updateCpe.isPending}>
              {updateCpe.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
