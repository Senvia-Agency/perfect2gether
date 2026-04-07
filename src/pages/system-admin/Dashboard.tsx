import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Building, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminMetricsCards } from "@/components/system-admin/AdminMetricsCards";
import { OrganizationsTable } from "@/components/system-admin/OrganizationsTable";
import type { OrgStripeData } from "@/components/system-admin/OrganizationsTable";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  billing_exempt: boolean | null;
  created_at: string | null;
}

interface OrgWithMembers extends OrgRow {
  member_count: number;
}

interface StripeStatsResponse {
  mrr: number;
  paying_count: number;
  total_subscriptions: number;
  org_stats: OrgStripeData[];
}

export default function SystemAdminDashboard() {
  const { switchOrganization, organization } = useAuth();

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["super-admin-all-orgs"],
    queryFn: async (): Promise<OrgWithMembers[]> => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, slug, code, plan, trial_ends_at, billing_exempt, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: members, error: mErr } = await supabase
        .from("organization_members")
        .select("organization_id");
      if (mErr) throw mErr;

      const counts: Record<string, number> = {};
      (members || []).forEach((m) => {
        counts[m.organization_id] = (counts[m.organization_id] || 0) + 1;
      });

      return (orgs || []).map((o) => ({
        ...o,
        member_count: counts[o.id] || 0,
      }));
    },
  });

  const { data: stripeStats, isLoading: stripeLoading } = useQuery({
    queryKey: ["super-admin-stripe-stats"],
    queryFn: async (): Promise<StripeStatsResponse> => {
      const { data, error } = await supabase.functions.invoke("admin-stripe-stats");
      if (error) throw error;
      return data as StripeStatsResponse;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 min
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Painel Super Admin</h1>
          <p className="text-sm text-muted-foreground">Gestão global do sistema Senvia OS.</p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">A carregar dados...</div>
        ) : (
          <>
            <AdminMetricsCards
              organizations={organizations}
              stripeStats={stripeStats ? { mrr: stripeStats.mrr, paying_count: stripeStats.paying_count, total_subscriptions: stripeStats.total_subscriptions } : null}
              stripeLoading={stripeLoading}
            />
            <OrganizationsTable
              organizations={organizations}
              currentOrgId={organization?.id}
              onAccessOrg={(id) => switchOrganization(id)}
              stripeData={stripeStats?.org_stats}
            />
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/system-admin/organizations">
              <Building className="h-4 w-4 mr-2" />
              Gerir Organizações
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/system-admin/users">
              <Users className="h-4 w-4 mr-2" />
              Gerir Utilizadores
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/system-admin/announcements">
              <Sparkles className="h-4 w-4 mr-2" />
              Gerir Novidades
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">← Voltar ao Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
