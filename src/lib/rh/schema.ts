import { z } from "zod";
export const periodSchema = z.object({
  id: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  period_type: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  business_days: z.coerce.number(),
  status: z.string(),
});
export const absenceSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  absence_type: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  allocation: z.string(),
  periods: z.array(periodSchema),
});
export type RhAbsenceAction =
  | "create"
  | "edit"
  | "batch"
  | "approve"
  | "partial"
  | "reject"
  | "cancel"
  | "withdraw";
export type RhDecisionMode = "partial" | "reject" | "cancel" | "withdraw";
export const recordKindSchema = z.enum([
  "employee",
  "document",
  "health",
  "group",
  "notice",
  "department",
  "subject",
  "ticket",
  "message",
  "recipient",
]);
export type RhRecordKind = z.infer<typeof recordKindSchema>;
export const recordSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  kind: recordKindSchema,
  parent_id: z.string().nullable(),
  data: z.record(
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
    ]),
  ),
  created_at: z.string(),
});
export const snapshotSchema = z.object({
  calendar: z.array(absenceSchema),
  absences: z.array(absenceSchema),
  records: z.array(recordSchema),
  balances: z.array(
    z.object({
      user_id: z.string(),
      year: z.number(),
      total_days: z.coerce.number(),
      used_days: z.coerce.number(),
      pending_days: z.coerce.number(),
      company_reserved_days: z.coerce.number(),
      personal_available_days: z.coerce.number(),
      company_available_days: z.coerce.number(),
    }),
  ),
  holidays: z.array(
    z.object({ id: z.string(), date: z.string(), name: z.string() }),
  ),
  history: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      absence_id: z.string(),
      actor_id: z.string(),
      actor_name: z.string(),
      before_data: z
        .object({ periods: z.array(periodSchema), status: z.string() })
        .nullable(),
      after_data: z
        .object({ periods: z.array(periodSchema), status: z.string() })
        .nullable(),
      action: z.string(),
      reason: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  notifications: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      state: z.string(),
      due_at: z.string(),
      payload: z.record(
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.string()),
        ]),
      ),
    }),
  ),
  permissions: z.record(z.boolean()),
  members: z.array(
    z.object({
      user_id: z.string(),
      full_name: z.string().nullable(),
      email: z.string().nullable(),
    }),
  ),
});
export type RhSnapshot = z.infer<typeof snapshotSchema>;
export type RhRecord = z.infer<typeof recordSchema>;
export type RhAbsence = z.infer<typeof absenceSchema>;
export const absenceTypes = {
  vacation: "Férias",
  sick_leave: "Baixa médica",
  appointment: "Consulta",
  personal_leave: "Pessoal",
  maternity: "Maternidade",
  paternity: "Paternidade",
  training_online: "Formação online",
  training: "Formação presencial",
  other: "Outro",
} as const;
export const statusLabels: Readonly<Record<string, string>> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  partially_approved: "Aprovado parcialmente",
  open: "Aberto",
  in_progress: "Em tratamento",
  resolved: "Resolvido",
  closed: "Encerrado",
};
export function text(
  data: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}
