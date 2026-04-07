import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  MessagesSquare, 
  Star, 
  Copy, 
  Trash2, 
  ExternalLink,
  MoreHorizontal,
  Edit,
  Loader2,
  Power,
  PowerOff,
  Code
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useForms, useDeleteForm, useDuplicateForm, useUpdateForm } from '@/hooks/useForms';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Form } from '@/types';
import { PRODUCTION_URL } from '@/lib/constants';
import { CreateFormModal } from './CreateFormModal';
import { FormEditor } from './FormEditor';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function FormsManager() {
  const { organization } = useAuth();
  const { data: forms, isLoading } = useForms();
  const deleteForm = useDeleteForm();
  const duplicateForm = useDuplicateForm();
  const updateForm = useUpdateForm();
  const { limits, planName } = useSubscription();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const getFormUrl = (form: Form) => {
    if (!organization?.slug) return '';
    const prefix = form.form_settings.mode === 'conversational' ? '/c/' : '/f/';
    // For default form, use org slug only; for others, add form slug
    if (form.is_default) {
      return `${PRODUCTION_URL}${prefix}${organization.slug}`;
    }
    return `${PRODUCTION_URL}${prefix}${organization.slug}/${form.slug}`;
  };

  const handleOpenForm = (form: Form) => {
    window.open(getFormUrl(form), '_blank', 'noopener,noreferrer');
  };

  const handleCopyUrl = async (form: Form) => {
    await navigator.clipboard.writeText(getFormUrl(form));
    toast.success('URL copiado!');
  };

  const handleCopyEmbed = async (form: Form, embedMode: 'iframe' | 'redirect') => {
    const formPath = form.form_settings.mode === 'conversational' ? 'c' : 'f';
    const slug = form.is_default 
      ? organization?.slug 
      : `${organization?.slug}/${form.slug}`;
    
    let code: string;
    if (embedMode === 'iframe') {
      code = `<div id="senvia-form"></div>\n<script src="${PRODUCTION_URL}/embed.js" data-form="${slug}" data-path="${formPath}" data-mode="iframe"></script>`;
    } else {
      code = `<script src="${PRODUCTION_URL}/embed.js" data-form="${slug}" data-path="${formPath}" data-mode="redirect"></script>`;
    }
    
    await navigator.clipboard.writeText(code);
    toast.success('Código embed copiado!');
  };

  const handleSetDefault = (form: Form) => {
    updateForm.mutate({ id: form.id, is_default: true });
  };

  const handleToggleActive = (form: Form) => {
    updateForm.mutate({ id: form.id, is_active: !form.is_active });
  };

  const handleDeleteConfirm = () => {
    if (formToDelete) {
      deleteForm.mutate(formToDelete.id);
      setFormToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If editing a form, show the editor
  if (editingForm) {
    return (
      <FormEditor 
        form={editingForm} 
        onBack={() => setEditingForm(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Formulários</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gira múltiplos formulários para diferentes campanhas
          </p>
        </div>
        <Button onClick={() => {
          if (limits.maxForms !== null && forms && forms.length >= limits.maxForms) {
            toast.error(`Limite de ${limits.maxForms} formulários atingido no plano ${planName}`);
            setShowUpgradeModal(true);
            return;
          }
          setShowCreateModal(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Formulário</span>
        </Button>
      </div>

      {/* Forms List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms?.map((form) => (
          <Card 
            key={form.id} 
            className={cn(
              "relative transition-all hover:shadow-md",
              !form.is_active && "opacity-60"
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    form.form_settings.mode === 'conversational' 
                      ? "bg-violet-500/10" 
                      : "bg-primary/10"
                  )}>
                    {form.form_settings.mode === 'conversational' ? (
                      <MessagesSquare className="h-4 w-4 text-violet-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-medium truncate">
                      {form.name}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      /{form.slug}
                    </CardDescription>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingForm(form)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenForm(form)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyUrl(form)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar URL
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyEmbed(form, 'iframe')}>
                      <Code className="h-4 w-4 mr-2" />
                      Copiar Embed (Formulário)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyEmbed(form, 'redirect')}>
                      <Code className="h-4 w-4 mr-2" />
                      Copiar Embed (Botão)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateForm.mutate(form.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!form.is_default && (
                      <DropdownMenuItem onClick={() => handleSetDefault(form)}>
                        <Star className="h-4 w-4 mr-2" />
                        Definir como Principal
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleToggleActive(form)}>
                      {form.is_active ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-2" />
                          Ativar
                        </>
                      )}
                    </DropdownMenuItem>
                    {!form.is_default && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setFormToDelete(form)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1.5">
                {form.is_default && (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Star className="h-3 w-3" />
                    Principal
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {form.form_settings.mode === 'conversational' ? 'Conversacional' : 'Tradicional'}
                </Badge>
                {!form.is_active && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Inativo
                  </Badge>
                )}
              </div>

              <p className="mt-3 text-xs text-muted-foreground truncate">
                {getFormUrl(form)}
              </p>
            </CardContent>
          </Card>
        ))}

        {/* Empty state / Add new card */}
        {forms?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground text-center mb-4">
                Ainda não tem formulários criados
              </p>
              <Button onClick={() => setShowCreateModal(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Formulário
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <CreateFormModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!formToDelete} onOpenChange={() => setFormToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O formulário "{formToDelete?.name}" será 
              eliminado permanentemente. Os leads associados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        featureName="Formulários"
        requiredPlan="Pro"
      />
    </div>
  );
}
