import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateContactList } from "@/hooks/useContactLists";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateListModal({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateContactList();

  const handleSubmit = async () => {
    await create.mutateAsync({ name, description });
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Lista</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da lista</Label>
            <Input placeholder="Ex: Clientes VIP" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea placeholder="Descreva o objetivo desta lista..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "A criar..." : "Criar Lista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
