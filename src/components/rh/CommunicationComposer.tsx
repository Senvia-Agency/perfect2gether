import { value } from "@/lib/rh/form";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Textarea } from "@/components/ui/textarea";
import { Field, MemberSelect, Submit } from "./Fields";
import { text } from "@/lib/rh/schema";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

export function CommunicationComposer({data,workspace,mode,onClose}: {
 readonly data: RhSnapshot; readonly workspace: ReturnType<typeof useRhWorkspace>; readonly mode: "notice" | "group" | null; readonly onClose: () => void;
}) {
  const [recipientError, setRecipientError] = useState(false);
  const [group, setGroup] = useState("");
  const groups = data.records.filter((r) => r.kind === "group");
  const recipients = (f: FormData) => {
    const explicit = f
      .getAll("recipients")
      .filter((x): x is string => typeof x === "string");
    const g = groups.find((r) => r.id === group)?.data.recipients;
    return [
      ...new Set([
        ...explicit,
        ...(Array.isArray(g)
          ? g.filter((x): x is string => typeof x === "string")
          : []),
      ]),
    ];
  };

 return <Dialog open={mode !== null} onOpenChange={open => {if(!open) onClose();}}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{mode === "notice" ? "Publicar aviso" : "Criar grupo"}</DialogTitle><DialogDescription>{mode === "notice" ? "Escolha o conteúdo e os destinatários." : "Os grupos organizam destinatários; não alteram permissões."}</DialogDescription></DialogHeader>
 {mode === "notice" ? <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const selected = recipients(f);
                  setRecipientError(selected.length === 0);
                  if (selected.length === 0) return;
                  void workspace.mutate.mutateAsync({
                    kind: "record",
                    recordKind: "notice",
                    data: {
                      title: value(f, "notice-title"),
                      body: value(f, "notice-body"),
                      recipients: selected,
                      active: true,
                    },
                  }).then(onClose).catch(() => undefined);
                }}
              >
                <Field name="notice-title" label="Título" required />
                <Field name="notice-body" label="Aviso">
                  <Textarea id="notice-body" name="notice-body" required />
                </Field>
                <Field name="notice-group" label="Grupo RH">
                  <select
                    id="notice-group"
                    className="w-full rounded-md border bg-background p-2"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    <option value="">Sem grupo</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {text(g.data, "name")}
                      </option>
                    ))}
                  </select>
                </Field>
                <MemberSelect
                  data={data}
                  name="recipients"
                  label="Destinatários adicionais "
                  multiple
                />
                <p className="text-sm text-muted-foreground">
                  Selecione pelo menos um destinatário; para todos, use um grupo
                  com toda a equipa.
                </p>
                {recipientError && <p role="alert" className="text-sm text-destructive">Selecione pelo menos um destinatário ou um grupo com membros.</p>}
                <Submit
                  busy={workspace.mutate.isPending}
                  label="Publicar aviso"
                />
              </form> : <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void workspace.mutate.mutateAsync({
                    kind: "record",
                    recordKind: "group",
                    data: {
                      name: value(f, "group-name"),
                      active: true,
                      recipients: f
                        .getAll("group-members")
                        .filter((x): x is string => typeof x === "string"),
                    },
                  }).then(onClose).catch(() => undefined);
                }}
              >
                <Field name="group-name" label="Nome do grupo" required />
                <MemberSelect data={data} name="group-members" multiple />
                <Submit busy={workspace.mutate.isPending} label="Criar grupo" />
              </form>}
 </DialogContent></Dialog>;
}
