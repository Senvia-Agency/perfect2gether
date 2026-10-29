import { Mail, Phone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientPersonRoleRow } from "@/lib/decision-makers";
import { getWhatsAppUrl } from "@/lib/format";

interface ClientPeopleCardProps {
  readonly rows: readonly ClientPersonRoleRow[];
}

const roleLabels = {
  decision_maker: "Decisores",
  legal_manager: "Gerentes legais",
  shareholder: "Sócios",
} as const;
const clientPersonRoles = ['decision_maker', 'legal_manager', 'shareholder'] as const;

const sourceLabels = {
  legacy: "Legado",
  manual: "Manual",
  mj: "MJ",
  crc_lookup: "CRC",
} as const;

function PersonRow({ row }: { readonly row: ClientPersonRoleRow }) {
  return (
    <div className="space-y-1 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{row.name}</p>
          {row.nif && <p className="text-xs text-muted-foreground">NIF: {row.nif}</p>}
        </div>
        <Badge variant="secondary" className="text-xs">{sourceLabels[row.role_source]}</Badge>
      </div>
      {row.phone && (
        <div className="flex flex-wrap items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <a href={`tel:${row.phone}`} className="hover:underline">{row.phone}</a>
          <a href={getWhatsAppUrl(row.phone)} target="_blank" rel="noopener noreferrer" className="text-xs text-success hover:underline">WhatsApp</a>
        </div>
      )}
      {row.email && (
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <a href={`mailto:${row.email}`} className="break-all text-primary hover:underline">{row.email}</a>
        </div>
      )}
      {row.role === "decision_maker" && !row.is_complete && <p className="text-xs text-warning-foreground">Contacto legado incompleto.</p>}
    </div>
  );
}

export function ClientPeopleCard({ rows }: ClientPeopleCardProps) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Intervenientes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {clientPersonRoles.map(role => {
          const people = rows.filter(row => row.role === role);
          if (people.length === 0) return null;
          return (
            <section key={role} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">{roleLabels[role]}</h3>
                <Badge variant="secondary" className="text-xs">{people.length}</Badge>
              </div>
              <div className="space-y-2">
                {people.map(row => <PersonRow key={`${row.person_id}-${row.role}`} row={row} />)}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
