import type { RhSnapshot } from "./schema";

export function scopeRhSnapshot(data: RhSnapshot, userId: string, administrator: boolean): RhSnapshot {
  if (data.permissions["administration.manage"] ?? administrator) return data;
  const tickets = new Set(data.records.filter(r => r.kind === "ticket" && r.user_id === userId).map(r => r.id));
  return {
    ...data,
    permissions: Object.fromEntries(Object.keys(data.permissions).map(key => [key, false])),
    absences: data.absences.filter(r => r.user_id === userId),
    calendar: data.calendar.filter(r => r.user_id === userId),
    balances: data.balances.filter(r => r.user_id === userId),
    members: data.members.filter(r => r.user_id === userId),
    history: data.history.filter(r => r.user_id === userId),
    notifications: data.notifications.filter(r => r.user_id === userId),
    records: data.records.filter(r => {
      if (r.kind === "department" || r.kind === "subject") return true;
      if (r.kind === "notice") return r.data.active !== false && (!Array.isArray(r.data.recipients) || r.data.recipients.length === 0 || r.data.recipients.includes(userId));
      if (r.kind === "message" || (r.kind === "document" && r.parent_id)) return r.parent_id !== null && tickets.has(r.parent_id);
      if (r.kind === "group" || r.kind === "recipient") return false;
      return r.user_id === userId;
    }),
  };
}
