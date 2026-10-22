import { Building2, Mail, MapPin, Tags, Users } from "lucide-react";
import type { MjCompanyData, MjPerson } from "@/lib/prospects/mj-metadata";

function Section({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function PeopleList({ people }: { people: MjPerson[] }) {
  return (
    <ul className="space-y-1.5">
      {people.map((person) => (
        <li key={`${person.nif ?? person.nome}-${person.cargo}`} className="rounded-md border px-2.5 py-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium">{person.nome}</span>
            {person.cargo && <span className="text-xs text-muted-foreground">{person.cargo}</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {person.nif && <span>NIF {person.nif}</span>}
            {person.email && (
              <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3 w-3" />
                {person.email}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MjCompanyDetails({ data }: { data: MjCompanyData }) {
  const postal = [data.codigoPostal, data.localidade].filter(Boolean).join(" ");
  const area = [data.freguesia, data.concelho, data.distrito].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <Section icon={MapPin} title="Sede">
        {data.morada || postal || area ? (
          <>
            {data.morada && <p>{data.morada}</p>}
            {postal && <p>{postal}</p>}
            {area && <p className="text-muted-foreground">{area}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">Sem morada na publicação.</p>
        )}
      </Section>

      <Section icon={Tags} title="CAE">
        {data.caePrincipal ? (
          <p>
            <span className="font-medium">{data.caePrincipal}</span> (principal)
            {data.caeSecundarios.length > 0 && <span className="text-muted-foreground"> · {data.caeSecundarios.join(", ")}</span>}
          </p>
        ) : (
          <p className="text-muted-foreground">CAE não encontrado.</p>
        )}
      </Section>

      <Section icon={Users} title="Gerência">
        {data.gerentes.length ? <PeopleList people={data.gerentes} /> : <p className="text-muted-foreground">Sem gerentes nesta publicação.</p>}
      </Section>

      {data.socios.length > 0 && (
        <Section icon={Users} title="Sócios">
          <PeopleList people={data.socios} />
        </Section>
      )}

      <Section icon={Building2} title="Empresa">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {data.naturezaJuridica && (<><dt className="text-muted-foreground">Natureza</dt><dd>{data.naturezaJuridica}</dd></>)}
          {data.capital && (<><dt className="text-muted-foreground">Capital</dt><dd>{data.capital}</dd></>)}
          {data.objeto && (<><dt className="text-muted-foreground">Objeto</dt><dd>{data.objeto}</dd></>)}
          {data.acto && (<><dt className="text-muted-foreground">Ato</dt><dd>{data.acto}{data.publicationDate ? ` (${data.publicationDate})` : ""}</dd></>)}
        </dl>
      </Section>
    </div>
  );
}
