import { VacationBalances } from "./VacationBalances";
import { value, memberName } from "@/lib/rh/form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Submit } from "./Fields";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
export function CalendarBalances({
  data,
  workspace,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [member, setMember] = useState("all");
  const [status, setStatus] = useState("approved");
  const [type, setType] = useState("all");
  const year = Number(month.slice(0, 4));
  const first = new Date(`${month}-01T12:00:00`);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{workspace.isAdmin ? "Calendário da equipa" : "O meu calendário"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 print:hidden">
            <Field label="Mês" name="month">
              <input
                id="month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-md border bg-background p-2"
              />
            </Field>
            {workspace.isAdmin && <Field label="Colaborador" name="calendar-member">
              <select
                id="calendar-member"
                value={member}
                onChange={(e) => setMember(e.target.value)}
                className="w-full rounded-md border bg-background p-2"
              >
                <option value="all">Todos</option>
                {data.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email}
                  </option>
                ))}
              </select>
            </Field>}
            <Field label="Estado" name="calendar-status">
              <select
                id="calendar-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border bg-background p-2"
              >
                <option value="all">Todos</option>
                <option value="approved">Aprovados</option>
                <option value="pending">Pendentes</option>
              </select>
            </Field>
            <Field label="Tipo" name="calendar-type">
              <select
                id="calendar-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border bg-background p-2"
              >
                <option value="all">Todos</option>
                <option value="vacation">Férias</option>
                <option value="other">Outras ausências</option>
              </select>
            </Field>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7 gap-1">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                <p key={day} className="text-center text-xs font-medium">
                  {day}
                </p>
              ))}
              {Array.from({ length: (first.getDay() + 6) % 7 }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                const requests = data.calendar.filter(
                  (a) =>
                    (member === "all" || a.user_id === member) &&
                    !["cancelled", "rejected"].includes(a.status) &&
                    (type === "all" ||
                      (type === "other"
                        ? a.absence_type !== "vacation"
                        : a.absence_type === type)) &&
                    new Date(date + "T12:00:00").getDay() !== 0 &&
                    new Date(date + "T12:00:00").getDay() !== 6 &&
                    !data.holidays.some((h) => h.date === date) &&
                    a.periods.some(
                      (p) =>
                        p.start_date <= date &&
                        p.end_date >= date &&
                        ["approved", "pending"].includes(p.status) &&
                        (status === "all" || p.status === status),
                    ),
                );
                const holiday = data.holidays.find((h) => h.date === date);
                return (
                  <div
                    key={date}
                    className="min-h-20 overflow-hidden rounded border p-1 text-xs sm:p-2"
                  >
                    <span className="font-semibold">{i + 1}</span>
                    {holiday && (
                      <p className="break-words text-muted-foreground">
                        {holiday.name}
                      </p>
                    )}
                    {requests.map((a) => (
                      <p
                        key={a.id}
                        className="mt-1 break-words rounded bg-primary/10 p-1"
                        title={`${memberName(data, a.user_id)} · ${a.absence_type}`}
                      >
                        {memberName(data, a.user_id)}
                        <span className="hidden sm:inline">
                          {" "}
                          ·{" "}
                          {a.absence_type === "vacation"
                            ? "Férias"
                            : "Ausência"}
                        </span>
                        {a.periods
                          .filter(
                            (p) =>
                              p.start_date <= date &&
                              p.end_date >= date &&
                              p.period_type !== "full_day" &&
                              ["approved", "pending"].includes(p.status),
                          )
                          .map((p) => (
                            <span key={p.id} className="block text-xs">
                              {p.start_time}–{p.end_time}
                            </span>
                          ))}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <Button
            variant="outline"
            className="print:hidden"
            onClick={() => window.print()}
          >
            Imprimir calendário
          </Button>
        </CardContent>
      </Card>
      <VacationBalances data={data} workspace={workspace} year={year} />
      {data.permissions["calendar.manage"] && (
        <Card>
          <CardHeader>
            <CardTitle>Feriados e encerramentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.holidays
              .filter((h) => h.date.startsWith(String(year)))
              .map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {h.date} · {h.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void workspace.mutate.mutateAsync({
                        kind: "holiday",
                        date: h.date,
                        name: h.name,
                        id: h.id,
                        remove: true,
                      })
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void workspace.mutate.mutateAsync({
                  kind: "holiday",
                  date: value(f, "holiday-date"),
                  name: value(f, "holiday-name"),
                });
              }}
            >
              <Field name="holiday-date" label="Data" type="date" required />
              <Field name="holiday-name" label="Nome" required />
              <Submit
                busy={workspace.mutate.isPending}
                label="Adicionar feriado"
              />
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
