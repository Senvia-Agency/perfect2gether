import { value, memberName } from "@/lib/rh/form";
import { useState } from "react";
import { ListPager } from "./ListPager";
import { ConfigRecords } from "./ConfigRecords";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Field, MemberSelect, Submit } from "./Fields";
import { text } from "@/lib/rh/schema";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

export function NotificationSettings({
  data,
  workspace,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [page, setPage] = useState(1);
  const recipients = data.records.filter(r => r.kind === "recipient");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Destinatários e processamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void workspace.mutate.mutateAsync({
              kind: "record",
              recordKind: "recipient",
              data: {
                name: "Destinatários RH",
                recipients: f
                  .getAll("notify-users")
                  .filter((x): x is string => typeof x === "string"),
                channel: value(f, "channel"),
                active: true,
                event: value(f, "notify-event"),
                department_id: null,
                emails: value(f, "notify-emails")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              },
            });
          }}
        >
          <MemberSelect
            data={data}
            name="notify-users"
            label="Receber pedidos de suporte e ausências"
            multiple
          />
          <Field name="channel" label="Canal">
            <select
              id="channel"
              name="channel"
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="in_app">Na aplicação</option>
              <option value="email">Email</option>
            </select>
          </Field>
          <Field name="notify-event" label="Evento">
            <select
              name="notify-event"
              id="notify-event"
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="all">Todos</option>
              <option value="absence">Ausências</option>
              <option value="birthday">Aniversários</option>
              <option value="health">Saúde</option>
              <option value="support">Suporte</option>
            </select>
          </Field>
          <Field
            name="notify-emails"
            label="Emails adicionais (apenas canal Email; separados por vírgula)"
          />
          <Submit
            busy={workspace.mutate.isPending}
            label="Guardar destinatários"
          />
        </form>
        {recipients.slice((page - 1) * 6, page * 6)
          .map((r) => (
            <p key={r.id} className="text-sm">
              {Array.isArray(r.data.recipients)
                ? r.data.recipients
                    .map((id) => memberName(data, String(id)))
                    .join(", ")
                : ""}{" "}
              · {text(r.data, "channel")}
            </p>
          ))}
        <Button
          variant="outline"
          onClick={() => void workspace.mutate.mutateAsync({ kind: "tick" })}
          disabled={workspace.mutate.isPending}
        >
          Processar lembretes na aplicação
        </Button>
        <p className="text-sm text-muted-foreground">
          Aniversários e consultas geram notificações duráveis. Emails serão
          enviados pelo serviço de notificações.
        </p>
        <ConfigRecords
          records={recipients.slice((page - 1) * 6, page * 6)}
          data={data}
          workspace={workspace}
        />
        <ListPager page={page} total={recipients.length} size={6} onChange={setPage} />
        <a href="/settings" className="text-sm text-primary underline">
          Configurar permissões RH nos perfis da equipa
        </a>
      </CardContent>
    </Card>
  );
}
