import { useState } from 'react';
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
import { useCreateCpe } from '@/hooks/useCpes';
import { EQUIPMENT_TYPES, COMERCIALIZADORES, ENERGY_TYPES, ENERGY_COMERCIALIZADORES, NIVEL_TENSAO_OPTIONS, type CpeStatus, type NivelTensao } from '@/types/cpes';

interface CreateCpeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  isTelecom?: boolean;
}

export function CreateCpeModal({ open, onOpenChange, clientId, isTelecom = false }: CreateCpeModalProps) {
  const createCpe = useCreateCpe();
  
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
  const modalTitle = isTelecom ? 'Adicionar CPE/CUI' : 'Adicionar CPE';
  const modalDescription = isTelecom 
    ? 'Registe um novo ponto de consumo para este cliente.' 
    : 'Registe um novo equipamento para este cliente.';

  const resetForm = () => {
    setEquipmentType('');
    setCustomEquipmentType('');
    setSerialNumber('');
    setComercializador('');
    setCustomComercializador('');
    setFidelizacaoStart('');
    setFidelizacaoEnd('');
    setStatus('active');
    setNivelTensao('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalEquipmentType = equipmentType === 'Outro' ? customEquipmentType : equipmentType;
    const finalComercializador = comercializador === 'Outro' ? customComercializador : comercializador;

    if (!finalEquipmentType || !finalComercializador) return;

    createCpe.mutate({
      client_id: clientId,
      equipment_type: finalEquipmentType,
      serial_number: serialNumber || undefined,
      comercializador: finalComercializador,
      fidelizacao_start: fidelizacaoStart || undefined,
      fidelizacao_end: fidelizacaoEnd || undefined,
      status,
      nivel_tensao: isTelecom && nivelTensao ? nivelTensao : undefined,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      }
    });
  };

  const isValid = (equipmentType === 'Outro' ? customEquipmentType : equipmentType) && 
                  (comercializador === 'Outro' ? customComercializador : comercializador);

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
              <Label>Fim Fidelização</Label>
              <Input
                type="date"
                value={fidelizacaoEnd}
                onChange={(e) => setFidelizacaoEnd(e.target.value)}
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
            <Button type="submit" disabled={!isValid || createCpe.isPending}>
              {createCpe.isPending ? 'A guardar...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
