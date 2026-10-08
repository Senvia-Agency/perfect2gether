import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { snapshotSchema } from "./schema";
import { loadRh } from "./load";
import type { Json } from "@/integrations/supabase/types";
type RhDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      rh_storage_cleanup_request: {
        Args: { _org: string; _path: string; _immediate?: boolean };
        Returns: string;
      };
      rh_calendar: { Args: { _org: string }; Returns: Json };
      rh_directory: { Args: { _org: string }; Returns: Json };
      rh_snapshot: { Args: { _org: string }; Returns: Json };
      rh_absence_mutate: {
        Args: { _org: string; _action: string; _payload: Json };
        Returns: Json;
      };
      rh_record_remove: {
        Args: { _org: string; _id: string };
        Returns: undefined;
      };
      rh_record_save: {
        Args: {
          _org: string;
          _kind: string;
          _data: Json;
          _id?: string;
          _user?: string;
          _parent?: string;
        };
        Returns: Json;
      };
      rh_balance_set: {
        Args: {
          _org: string;
          _user: string;
          _year: number;
          _total: number;
          _reserved?: number | null;
        };
        Returns: undefined;
      };
      rh_notification_tick: {
        Args: { _org: string; _limit?: number };
        Returns: number;
      };
      rh_holiday_set: {
        Args: {
          _org: string;
          _date: string;
          _name: string;
          _id?: string;
          _delete?: boolean;
        };
        Returns: undefined;
      };
    };
  };
};
export const rhClient = createClient<RhDatabase>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    accessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  },
);
export async function rhSnapshot(org: string) {
  const data = await loadRh((signal) => rhClient.rpc("rh_snapshot", { _org: org }).abortSignal(signal));
  return snapshotSchema.parse(data);
}
export async function privateUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("rh-private")
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
export async function uploadPrivate(org: string, user: string, file: File) {
  const path = `${org}/${user}/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: registrationError } = await rhClient.rpc(
    "rh_storage_cleanup_request",
    { _org: org, _path: path },
  );
  if (registrationError) throw registrationError;
  const { error } = await supabase.storage
    .from("rh-private")
    .upload(path, file);
  if (error) throw error;
  return path;
}
