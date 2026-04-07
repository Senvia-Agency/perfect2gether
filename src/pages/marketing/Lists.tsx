import { useState } from "react";
import { Plus, Upload, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContactListsTable } from "@/components/marketing/ContactListsTable";
import { CreateListModal } from "@/components/marketing/CreateListModal";
import { ListDetailsModal } from "@/components/marketing/ListDetailsModal";
import { ImportContactsModal } from "@/components/marketing/ImportContactsModal";
import { useContactLists, useDeleteContactList, type ContactList } from "@/hooks/useContactLists";

export default function Lists() {
  const { data: lists = [], isLoading } = useContactLists();
  const deleteList = useDeleteContactList();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);

  return (
    <>
      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/marketing")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Listas de Transmissão</h1>
              <p className="text-muted-foreground text-sm">Gira listas de contactos para campanhas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova Lista
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <ContactListsTable lists={lists} onView={setSelectedList} onDelete={(id) => deleteList.mutate(id)} />
        )}
      </div>

      <CreateListModal open={createOpen} onOpenChange={setCreateOpen} />
      <ListDetailsModal list={selectedList} open={!!selectedList} onOpenChange={(o) => !o && setSelectedList(null)} />
      <ImportContactsModal open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
