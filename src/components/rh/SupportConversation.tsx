import { value, memberName } from "@/lib/rh/form";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Submit } from "./Fields";
import { text, statusLabels } from "@/lib/rh/schema";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { privateUrl } from "@/lib/rh/api";
import { toast } from "sonner";
import type { RhRecord } from "@/lib/rh/schema";
export function SupportConversation({
  data,
  workspace,
  ticket,
  manager,
  busy,
  reply,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly ticket: RhRecord;
  readonly manager: boolean;
  readonly busy: boolean;
  readonly reply: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{text(ticket.data, "title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>{text(ticket.data, "description")}</p>
        <p className="text-sm text-muted-foreground">
          Prioridade:{" "}
          {
            {
              low: "Baixa",
              normal: "Normal",
              high: "Alta",
              urgent: "Urgente",
            }[text(ticket.data, "priority")]
          }{" "}
          · {statusLabels[text(ticket.data, "status")]}
        </p>
        {manager && (
          <Field label="Alterar estado" name="ticket-status">
            <select
              id="ticket-status"
              value={text(ticket.data, "status")}
              onChange={(e) =>
                void workspace.mutate.mutateAsync({
                  kind: "record",
                  recordKind: "ticket",
                  id: ticket.id,
                  userId: ticket.user_id,
                  data: { ...ticket.data, status: e.target.value },
                })
              }
              className="w-full rounded-md border bg-background p-2"
            >
              {["open", "in_progress", "resolved", "closed"].map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {data.records
          .filter((r) => r.kind === "message" && r.parent_id === ticket.id)
          .map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {memberName(data, r.user_id)} ·{" "}
                {new Date(r.created_at).toLocaleString("pt-PT")}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{text(r.data, "body")}</p>
            </div>
          ))}
        {data.records
          .filter((r) => r.kind === "document" && r.parent_id === ticket.id)
          .map((r) => (
            <Button
              key={r.id}
              variant="link"
              className="max-w-full whitespace-normal break-all"
              onClick={() =>
                void privateUrl(text(r.data, "path"))
                  .then((url) =>
                    window.open(url, "_blank", "noopener,noreferrer"),
                  )
                  .catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Erro ao abrir anexo",
                    ),
                  )
              }
            >
              {text(r.data, "name")}
            </Button>
          ))}
        {text(ticket.data, "status") !== "closed" && (
          <form onSubmit={(e) => void reply(e)} className="space-y-3">
            <Field label="Mensagem" name="body">
              <Textarea id="body" name="body" required />
            </Field>
            <Field label="Anexos privados" name="ticket-files">
              <Input
                id="ticket-files"
                name="ticket-files"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx"
              />
            </Field>
            <Submit busy={busy} label="Responder" />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
