import { useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LogIn, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  billing_exempt: boolean | null;
  created_at: string | null;
  member_count: number;
}

export interface OrgStripeData {
  org_id: string;
  stripe_plan: string | null;
  stripe_amount: number;
  stripe_status: string | null;
  stripe_period_end: string | null;
  has_stripe_subscription: boolean;
}

type Filter = "all" | "paying" | "trial" | "expired" | "exempt";

interface OrganizationsTableProps {
  organizations: Organization[];
  currentOrgId?: string;
  onAccessOrg: (orgId: string) => void;
  stripeData?: OrgStripeData[];
}

function getOrgStatus(org: Organization, stripeInfo?: OrgStripeData) {
  const now = new Date();
  if (org.billing_exempt) return "exempt";
  // If has active Stripe subscription -> paying
  if (stripeInfo?.has_stripe_subscription && stripeInfo.stripe_status === "active") return "paying";
  // Trial check
  if (org.trial_ends_at && new Date(org.trial_ends_at) > now) return "trial";
  // Has trialing subscription on Stripe
  if (stripeInfo?.has_stripe_subscription && stripeInfo.stripe_status === "trialing") return "trial";
  return "expired";
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paying: { label: "Pago", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  trial: { label: "Trial", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  expired: { label: "Expirado", className: "bg-destructive/20 text-destructive border-destructive/30" },
  exempt: { label: "Isento", className: "bg-muted text-muted-foreground border-border" },
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

export function OrganizationsTable({
  organizations,
  currentOrgId,
  onAccessOrg,
  stripeData,
}: OrganizationsTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const now = new Date();

  const stripeMap = new Map<string, OrgStripeData>();
  (stripeData || []).forEach(s => stripeMap.set(s.org_id, s));

  const filtered = organizations.filter((org) => {
    if (filter === "all") return true;
    return getOrgStatus(org, stripeMap.get(org.id)) === filter;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base lg:text-lg">Clientes Senvia OS</CardTitle>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-2">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all" className="text-xs">Todos ({organizations.length})</TabsTrigger>
            <TabsTrigger value="paying" className="text-xs">Pagantes</TabsTrigger>
            <TabsTrigger value="trial" className="text-xs">Trial</TabsTrigger>
            <TabsTrigger value="expired" className="text-xs">Expirados</TabsTrigger>
            <TabsTrigger value="exempt" className="text-xs">Isentos</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Stripe Ativo</TableHead>
                <TableHead className="hidden sm:table-cell">Stripe</TableHead>
                <TableHead className="hidden sm:table-cell">Membros</TableHead>
                <TableHead className="hidden md:table-cell">Trial</TableHead>
                <TableHead className="hidden lg:table-cell">Criada em</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhuma organização encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((org) => {
                  const stripeInfo = stripeMap.get(org.id);
                  const status = getOrgStatus(org, stripeInfo);
                  const config = STATUS_CONFIG[status];
                  const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
                  const diffMs = trialEnd ? trialEnd.getTime() - now.getTime() : null;
                  const daysLeft = diffMs !== null ? Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : null;

                  // Show Stripe plan if available, otherwise DB plan
                  const displayPlan = stripeInfo?.stripe_plan || org.plan;

                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[180px]">{org.name}</span>
                          <span className="text-xs text-muted-foreground">{org.slug}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {PLAN_LABELS[displayPlan || ""] || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px]", config.className)}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {stripeInfo?.has_stripe_subscription && stripeInfo.stripe_status === "active" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {stripeInfo?.has_stripe_subscription ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-emerald-400">
                              €{stripeInfo.stripe_amount}/mês
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {stripeInfo.stripe_status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {org.member_count}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {trialEnd
                          ? daysLeft !== null && daysLeft > 0
                            ? `${daysLeft}d restantes`
                            : "Expirado"
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {org.created_at
                          ? format(new Date(org.created_at), "dd MMM yyyy", { locale: pt })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={currentOrgId === org.id ? "default" : "ghost"}
                          size="icon-sm"
                          onClick={() => onAccessOrg(org.id)}
                          title="Entrar na organização"
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
