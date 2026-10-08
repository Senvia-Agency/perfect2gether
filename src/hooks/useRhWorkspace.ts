import { scopeRhSnapshot } from "@/lib/rh/scope";
import type { RhAbsenceAction, RhRecordKind } from "@/lib/rh/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { rhClient, rhSnapshot } from "@/lib/rh/api";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
export function useRhWorkspace() {
  const { organization, user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const org = organization?.id ?? "";
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["rh-workspace", org, user?.id],
    queryFn: () => rhSnapshot(org),
    enabled: !!org && !!user,
    retry: false,
    select: (data) => scopeRhSnapshot(data, user?.id ?? "", isAdmin),
  });
  const mutate = useMutation({
    mutationFn: async (
      command:
        | {
            readonly kind: "absence";
            readonly action: RhAbsenceAction;
            readonly payload: Json;
          }
        | {
            readonly kind: "record";
            readonly recordKind: RhRecordKind;
            readonly data: Json;
            readonly id?: string;
            readonly userId?: string;
            readonly parent?: string;
          }
        | {
            readonly kind: "balance";
            readonly userId: string;
            readonly year: number;
            readonly total: number;
            readonly reserved: number;
          }
        | { readonly kind: "remove"; readonly id: string }
        | { readonly kind: "tick" }
        | {
            readonly kind: "holiday";
            readonly date: string;
            readonly name: string;
            readonly id?: string;
            readonly remove?: boolean;
          },
    ) => {
      let result;
      switch (command.kind) {
        case "absence":
          result = await rhClient.rpc("rh_absence_mutate", {
            _org: org,
            _action: command.action,
            _payload: command.payload,
          });
          break;
        case "record":
          result = await rhClient.rpc("rh_record_save", {
            _org: org,
            _kind: command.recordKind,
            _data: command.data,
            ...(command.id ? { _id: command.id } : {}),
            ...(command.userId ? { _user: command.userId } : {}),
            ...(command.parent ? { _parent: command.parent } : {}),
          });
          break;
        case "balance":
          result = await rhClient.rpc("rh_balance_set", {
            _org: org,
            _user: command.userId,
            _year: command.year,
            _total: command.total,
            _reserved: command.reserved,
          });
          break;
        case "remove":
          result = await rhClient.rpc("rh_record_remove", {
            _org: org,
            _id: command.id,
          });
          break;
        case "tick":
          result = await rhClient.rpc("rh_notification_tick", { _org: org });
          break;
        case "holiday":
          result = await rhClient.rpc("rh_holiday_set", {
            _org: org,
            _date: command.date,
            _name: command.name,
            ...(command.id ? { _id: command.id } : {}),
            _delete: command.remove ?? false,
          });
          break;
      }
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rh-workspace"] });
      toast.success("Guardado com sucesso");
    },
    onError: (error) => toast.error(error.message),
  });
  return { ...query, mutate, org, userId: user?.id ?? "", isAdmin: query.data?.permissions["administration.manage"] ?? isAdmin };
}
