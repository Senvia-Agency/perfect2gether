import { Building2, Mail, MapPin, Tags, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MjCompanyData, MjPerson } from "@/lib/prospects/mj-metadata";

interface GroupedPerson {
  nome: string;
  nif: string | null;
  email: string | null;
  papeis: string[];
}

function groupPeople(gerentes: MjPerson[], socios: MjPerson[]): GroupedPerson[] {
  const byKey = new Map<string, GroupedPerson>();
  for (const person of [...gerentes, ...socios]) {
    const key = person.nif ?? person.nome.toLowerCase();
    const current = byKey.get(key) ?? { nome: person.nome, nif: person.nif, email: null, papeis: [] };
    if (person.cargo && !current.papeis.includes(person.cargo)) current.papeis.push(person.cargo);
    current.email = current.email ?? person.email;
    byKey.set(key, current);
  }
  return [...byKey.values()];
}

function Section({ icon: Icon, title, children, className = "" }: { icon: typeof MapPin; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

export function MjCompanyDetails({ data, compact = false }: { data: MjCompanyData; compact?: boolean }) {
  const postal = [data.codigoPostal, data.localidade].filter(Boolean).join(" ");
  const people = groupPeople(data.gerentes, data.socios);

  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
      <Section icon={MapPin} title="Sede">
        {data.morada || postal ? (
          <div className="space-y-0.5">
            {data.morada && <p className="break-words">{data.morada}</p>}
            {postal && <p>{postal}</p>}
          </div>
        ) : (
          <Empty>Sem morada na publicação.</Empty>
        )}
        {(data.freguesia || data.concelho || data.distrito) && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {data.freguesia && (<><dt className="text-muted-foreground">Freguesia</dt><dd>{data.freguesia}</dd></>)}
            {data.concelho && (<><dt className="text-muted-foreground">Concelho</dt><dd>{data.concelho}</dd></>)}
            {data.distrito && (<><dt className="text-muted-foreground">Distrito</dt><dd>{data.distrito}</dd></>)}
          </dl>
        )}
      </Section>

      <Section icon={Tags} title="CAE">
        {data.caePrincipal ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="font-mono">{data.caePrincipal}</Badge>
              <span className="text-xs text-muted-foreground">principal</span>
            </div>
            {data.caeSecundarios.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {data.caeSecundarios.map((code) => <Badge key={code} variant="secondary" className="font-mono">{code}</Badge>)}
                <span className="text-xs text-muted-foreground">secundários</span>
              </div>
            )}
          </div>
        ) : (
          <Empty>CAE não encontrado.</Empty>
        )}
      </Section>

      <Section icon={Users} title={`Gerência e sócios (${people.length})`} className="md:col-span-2">
        {people.length ? (
          <ul className="divide-y">
            {people.map((person) => (
              <li key={person.nif ?? person.nome} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{person.nome}</p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {person.nif && <span>NIF {person.nif}</span>}
                    {person.email && (
                      <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Mail className="h-3 w-3" />
                        {person.email}
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {person.papeis.map((papel) => <Badge key={papel} variant="outline" className="text-xs">{papel}</Badge>)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Sem gerentes ou sócios nesta publicação.</Empty>
        )}
      </Section>

      <Section icon={Building2} title="Empresa" className="md:col-span-2">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[8rem_1fr]">
          {data.naturezaJuridica && (<><dt className="text-muted-foreground">Natureza jurídica</dt><dd>{data.naturezaJuridica}</dd></>)}
          {data.capital && (<><dt className="text-muted-foreground">Capital</dt><dd>{data.capital}</dd></>)}
          {data.objeto && (<><dt className="text-muted-foreground">Objeto</dt><dd className="leading-relaxed">{data.objeto}</dd></>)}
          {data.acto && (<><dt className="text-muted-foreground">Publicação</dt><dd>{data.acto}{data.publicationDate ? ` · ${data.publicationDate}` : ""}</dd></>)}
        </dl>
      </Section>
    </div>
  );
}
