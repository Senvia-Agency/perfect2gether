import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, Submit } from "./Fields";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

export function BalanceEditor({
  data,
  workspace,
  year,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly year: number;
}) {
  const initialUser =
    data.members.find((m) => m.user_id === workspace.userId)?.user_id ??
    data.members[0]?.user_id ??
    "";
  const balanceFor = (owner: string, selectedYear: string) =>
    data.balances.find(
      (b) => b.user_id === owner && b.year === Number(selectedYear),
    );
  const initialBalance = balanceFor(initialUser, String(year));
  const [userId, setUserId] = useState(initialUser);
  const [selectedYear, setSelectedYear] = useState(String(year));
  const [total, setTotal] = useState(String(initialBalance?.total_days ?? 22));
  const [reserved, setReserved] = useState(
    String(initialBalance?.company_reserved_days ?? 0),
  );
  const selectBalance = (owner: string, nextYear: string) => {
    const balance = balanceFor(owner, nextYear);
    setTotal(String(balance?.total_days ?? 22));
    setReserved(String(balance?.company_reserved_days ?? 0));
  };
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        void workspace.mutate.mutateAsync({
          kind: "balance",
          userId,
          year: Number(selectedYear),
          total: Number(total),
          reserved: Number(reserved),
        });
      }}
    >
      <Field name="balance-user" label="Colaborador">
        <select
          id="balance-user"
          name="balance-user"
          className="w-full rounded-md border border-input bg-background p-2 text-sm"
          value={userId}
          required
          onChange={(e) => {
            setUserId(e.target.value);
            selectBalance(e.target.value, selectedYear);
          }}
        >
          {data.members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name || m.email}
            </option>
          ))}
        </select>
      </Field>
      <Field name="balance-year" label="Ano">
        <Input
          id="balance-year"
          name="year"
          type="number"
          step={1}
          min={2000}
          max={2200}
          value={selectedYear}
          required
          onChange={(e) => {
            setSelectedYear(e.target.value);
            selectBalance(userId, e.target.value);
          }}
        />
      </Field>
      <Field name="balance-total" label="Total anual (dias)">
        <Input
          id="balance-total"
          name="total"
          type="number"
          step="any"
          min={0}
          value={total}
          required
          onChange={(e) => setTotal(e.target.value)}
        />
      </Field>
      <Field name="balance-reserved" label="Reserva empresa (dias)">
        <Input
          id="balance-reserved"
          name="reserved"
          type="number"
          step="any"
          min={0}
          max={Number(total)}
          value={reserved}
          required
          onChange={(e) => setReserved(e.target.value)}
        />
      </Field>
      <Submit busy={workspace.mutate.isPending} label="Definir saldo" />
    </form>
  );
}
