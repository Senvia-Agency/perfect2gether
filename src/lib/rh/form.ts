import type { RhSnapshot } from "./schema";
export function value(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}
export function memberName(data: RhSnapshot, id: string) {
  const m = data.members.find((x) => x.user_id === id);
  return m?.full_name || m?.email || "Colaborador";
}
