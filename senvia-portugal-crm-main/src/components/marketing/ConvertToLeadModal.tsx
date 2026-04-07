import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Users } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeam";
import { useConvertProspectToLead } from "@/hooks/useConvertProspectToLead";
import type { MarketingContact } from "@/types/marketing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: MarketingContact[];
  onSuccess?: () => void;
}

export function ConvertToLeadModal({ open, onOpenChange, contacts, onSuccess }: Props) {
  const { data: members = [] } = useTeamMembers();
  const convert = useConvertProspectToLead();
  const [assignedTo, setAssignedTo] = useState<string>("none");

  const alreadyConverted = contacts.filter((c: any) => c.converted_to_lead).length;
  const toConvert = contacts.length - alreadyConverted;

  const handleConvert = async () => {
    await convert.mutateAsync({
      contacts,
      assignedTo: assignedTo === "none" ? null : assignedTo,
    });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Converter em Leads
          </DialogTitle>
          <DialogDescription>
            Criar leads a partir dos contactos selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" />
              {contacts.length} contacto(s) selecionado(s)
            </Badge>
            {alreadyConverted > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                {alreadyConverted} já convertido(s)
              </Badge>
            )}
          </div>

          {toConvert > 0 && (
            <div className="space-y-2">
              <Label>Atribuir comercial (opcional)</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem atribuição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem atribuição</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {toConvert === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Todos os contactos selecionados já foram convertidos em leads.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConvert} disabled={toConvert === 0 || convert.isPending}>
            {convert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Converter {toConvert} lead(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
