import { useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { TemplatesTable } from "@/components/marketing/TemplatesTable";
import { CreateTemplateModal } from "@/components/marketing/CreateTemplateModal";
import { EditTemplateModal } from "@/components/marketing/EditTemplateModal";
import { SendTemplateModal } from "@/components/marketing/SendTemplateModal";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import type { EmailTemplate } from "@/types/marketing";

export default function Templates() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState<EmailTemplate | null>(null);
  const { data: templates, isLoading } = useEmailTemplates();

  return (
    <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/marketing">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Templates de Email</h1>
              <p className="text-sm text-muted-foreground">
                Crie templates reutilizáveis para as suas campanhas
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>

        {/* Table */}
        <TemplatesTable
          templates={templates || []}
          isLoading={isLoading}
          onEdit={setEditingTemplate}
          onSend={setSendingTemplate}
        />

        {/* Create Modal */}
        <CreateTemplateModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />

        {/* Edit Modal */}
        <EditTemplateModal
          template={editingTemplate}
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
        />

        {/* Send Modal */}
        <SendTemplateModal
          template={sendingTemplate}
          open={!!sendingTemplate}
          onOpenChange={(open) => !open && setSendingTemplate(null)}
        />
    </div>
  );
}
