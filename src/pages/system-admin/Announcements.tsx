import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  content: string;
  version: string | null;
  image_url: string | null;
  is_active: boolean;
  published_at: string;
  created_at: string;
}

const emptyForm = { title: "", content: "", version: "", image_url: "", is_active: true };

export default function SystemAdminAnnouncements() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await (supabase as any)
        .from("app_announcements")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        content: form.content,
        version: form.version || null,
        image_url: form.image_url || null,
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("app_announcements").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("app_announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["latest-announcement"] });
      toast.success(editingId ? "Novidade atualizada" : "Novidade criada");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("app_announcements").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["latest-announcement"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("app_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["latest-announcement"] });
      toast.success("Novidade excluída");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content, version: a.version ?? "", image_url: a.image_url ?? "", is_active: a.is_active });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Gerir Novidades
            </h1>
            <p className="text-sm text-muted-foreground">Pop-ups de novidades para utilizadores.</p>
          </div>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Novidade</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma novidade criada.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Publicação</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.version || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(a.published_at), "dd MMM yyyy HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell>
                      <Switch checked={a.is_active} onCheckedChange={(v) => toggle.mutate({ id: a.id, is_active: v })} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Button variant="ghost" size="sm" asChild>
          <Link to="/system-admin"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Novidade" : "Nova Novidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Nova funcionalidade de Prospects" />
            </div>
            <div>
              <Label>Conteúdo (Markdown) *</Label>
              <Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Escreva aqui as novidades em Markdown..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Versão</Label>
                <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="v2.5" />
              </div>
              <div>
                <Label>URL da Imagem</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo (visível aos utilizadores)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.title || !form.content || save.isPending}>
              {save.isPending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir novidade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
