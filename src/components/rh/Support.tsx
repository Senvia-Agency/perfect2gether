import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ListPager } from "./ListPager";
import { SupportConversation } from "./SupportConversation";
import { value, memberName } from "@/lib/rh/form";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Field, Submit } from "./Fields";
import { text, statusLabels } from "@/lib/rh/schema";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { uploadPrivate } from "@/lib/rh/api";
import { toast } from "sonner";
export function Support({
  data,
  workspace,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const manager = data.permissions["support.manage"];
  const tickets = data.records.filter(
    (r) =>
      r.kind === "ticket" &&
      (filter === "all" || text(r.data, "status") === filter),
  );
  const ticket = tickets.find((r) => r.id === selected);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await workspace.mutate.mutateAsync({
      kind: "record",
      recordKind: "ticket",
      data: {
        title: value(f, "ticket-title"),
        description: value(f, "description"),
        priority: value(f, "priority"),
        status: "open",
      },
    });
    if (
      typeof r === "object" &&
      r !== null &&
      !Array.isArray(r) &&
      typeof r.id === "string"
    )
      setSelected(r.id);
    setCreating(false);
  }
  async function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ticket) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = value(f, "body");
    setBusy(true);
    try {
      await workspace.mutate.mutateAsync({
        kind: "record",
        recordKind: "message",
        parent: ticket.id,
        data: { body },
      });
      for (const file of f
        .getAll("ticket-files")
        .filter((x): x is File => x instanceof File && x.size > 0)) {
        const path = await uploadPrivate(workspace.org, workspace.userId, file);
        await workspace.mutate.mutateAsync({
          kind: "record",
          recordKind: "document",
          parent: ticket.id,
          data: { name: file.name, path, category: "Suporte interno RH" },
        });
      }
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao responder");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{manager ? "Pedidos da equipa" : "Os meus pedidos"}</h2>
        {!manager && <Button onClick={() => setCreating(true)}>Novo pedido</Button>}
      </div>
      <Dialog open={creating && !manager} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo pedido de suporte</DialogTitle><DialogDescription>Escreva o assunto e explique o pedido ao administrador.</DialogDescription></DialogHeader>
            <form onSubmit={(e) => void create(e)} className="space-y-3">
              <Field label="Assunto" name="ticket-title" required />
              <Field label="Prioridade" name="priority">
                <select
                  id="priority"
                  name="priority"
                  className="w-full rounded-md border bg-background p-2"
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>
              <Field label="Descrição" name="description">
                <Textarea id="description" name="description" required />
              </Field>
              <Submit busy={workspace.mutate.isPending} label="Criar pedido" />
            </form>
        </DialogContent>
      </Dialog>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{manager ? "Todos os pedidos" : "Os meus pedidos"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Estado" name="support-filter">
              <select
                id="support-filter"
                className="w-full rounded-md border bg-background p-2"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              >
                <option value="all">Todos</option>
                {["open", "in_progress", "resolved", "closed"].map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </Field>
            {tickets.slice((page - 1) * 8, page * 8).map((r) => (
              <Button
                key={r.id}
                variant={selected === r.id ? "secondary" : "outline"}
                className="h-auto w-full justify-start whitespace-normal text-left"
                onClick={() => setSelected(r.id)}
              >
                {text(r.data, "title")} · {statusLabels[text(r.data, "status")]}{" "}
                · {memberName(data, r.user_id)}
              </Button>
            ))}
            {!tickets.length && <p className="text-sm text-muted-foreground">Sem pedidos neste estado.</p>}
            <ListPager page={page} total={tickets.length} size={8} onChange={setPage} />
          </CardContent>
        </Card>
      <div className="space-y-6">
        {ticket && (
          <SupportConversation
            data={data}
            workspace={workspace}
            ticket={ticket}
            manager={manager}
            busy={busy}
            reply={reply}
          />
        )}
        {!ticket && <Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione um pedido para consultar a conversa e responder.</CardContent></Card>}
      </div>
      </div>

    </div>
  );
}
