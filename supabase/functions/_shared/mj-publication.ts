// Parses the text of a publication from publicacoes.mj.pt (DetalhePublicacao.aspx).
// Personal data that is not useful commercially (residence, marital status, spouse)
// is deliberately not extracted.

export interface MjPerson {
  nome: string;
  nif: string | null;
  cargo: string;
  email: string | null;
}

export interface MjPublication {
  natureza_juridica: string | null;
  sede: {
    morada: string | null;
    codigo_postal: string | null;
    localidade: string | null;
    freguesia: string | null;
    concelho: string | null;
    distrito: string | null;
  };
  objeto: string | null;
  capital: string | null;
  gerentes: MjPerson[];
  socios: MjPerson[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ENTRY_START = /^(TITULAR|Nome\/Firma)\s*:\s*(.+)$/i;
const ROLE_HEADINGS: [RegExp, string][] = [
  [/^GER[ÊE]NCIA\s*:?$/i, "Gerente"],
  [/^(CONSELHO DE )?ADMINISTRA[ÇC][ÃA]O\s*:?$/i, "Administrador"],
  [/^(FISCAL [ÚU]NICO|CONSELHO FISCAL)\s*:?$/i, "Fiscal"],
  [/^DIRE[CÇ][ÇC]?[ÃA]O\s*:?$/i, "Diretor"],
];

function value(line: string, label: RegExp): string | null {
  const match = line.match(label);
  return match ? match[1].trim() || null : null;
}

function parseSede(lines: string[]) {
  const sede: MjPublication["sede"] = { morada: null, codigo_postal: null, localidade: null, freguesia: null, concelho: null, distrito: null };
  const start = lines.findIndex((line) => /^Sede\s*:/i.test(line));
  if (start < 0) return sede;
  sede.morada = value(lines[start], /^Sede\s*:\s*(.*)$/i);
  for (const line of lines.slice(start + 1, start + 5)) {
    const area = line.match(/Distrito\s*:\s*(.*?)\s*Concelho\s*:\s*(.*?)\s*(?:Freguesia\s*:\s*(.*))?$/i);
    const postal = line.match(/^(\d{4})(?:\s*-\s*(\d{3}))?\s+(\D.*)$/);
    if (area) {
      sede.distrito = area[1] || null;
      sede.concelho = area[2] || null;
      sede.freguesia = area[3]?.trim() || null;
    } else if (postal) {
      sede.codigo_postal = postal[2] ? `${postal[1]}-${postal[2]}` : postal[1];
      sede.localidade = postal[3].trim();
      break;
    }
  }
  return sede;
}

function parseObjeto(lines: string[]): string | null {
  const start = lines.findIndex((line) => /^OBJE[CT]{1,2}O\s*:/i.test(line));
  if (start < 0) return null;
  const parts = [value(lines[start], /^OBJE[CT]{1,2}O\s*:\s*(.*)$/i) ?? ""];
  for (const line of lines.slice(start + 1)) {
    if (!line || /^[A-ZÀ-Ú ./()]+\s*:/.test(line)) break;
    parts.push(line);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim() || null;
}

function parsePeople(lines: string[], acto: string) {
  const gerentes: MjPerson[] = [];
  const socios: MjPerson[] = [];
  const onlyCessation = /CESSA[ÇC][ÃA]O/i.test(acto) && !/DESIGNA[ÇC][ÃA]O/i.test(acto);
  let section: "socios" | "orgaos" | null = null;
  let roleFromHeading = "Membro de órgão social";
  let current: (MjPerson & { kind: "socios" | "orgaos"; ceased: boolean }) | null = null;

  const flush = () => {
    if (!current) return;
    const { kind, ceased, ...person } = current;
    if (kind === "socios") socios.push(person);
    else if (!ceased && !onlyCessation) gerentes.push(person);
    current = null;
  };

  for (const line of lines) {
    if (/^S[ÓO]CIOS/i.test(line)) { flush(); section = "socios"; continue; }
    const heading = ROLE_HEADINGS.find(([pattern]) => pattern.test(line));
    if (heading) { flush(); section = "orgaos"; roleFromHeading = heading[1]; continue; }
    if (/^(ORG[ÃA]O\(S\) DESIGNADO|FORMA DE OBRIGAR)/i.test(line)) { flush(); section = "orgaos"; continue; }

    const entry = line.match(ENTRY_START);
    if (entry) {
      flush();
      const kind = /^TITULAR/i.test(entry[1]) ? "socios" : section ?? "orgaos";
      current = { kind, ceased: false, nome: entry[2].trim(), nif: null, cargo: kind === "socios" ? "Sócio" : roleFromHeading, email: null };
      continue;
    }
    if (!current) continue;
    const nif = value(line, /^NIF\/NIPC\s*:\s*(\d{9})/i);
    const cargo = value(line, /^Cargo\s*:\s*(.+)$/i);
    const email = value(line, /^Endere[çc]o eletr[óo]nico\s*:\s*(\S+)$/i);
    if (nif) current.nif = nif;
    if (cargo && current.kind === "orgaos") current.cargo = cargo;
    if (email && EMAIL.test(email)) current.email = email.toLowerCase();
    if (/^Causa\s*:/i.test(line)) current.ceased = true;
  }
  flush();

  const unique = (list: MjPerson[]) => list.filter((person, index) =>
    list.findIndex((other) => (other.nif ?? other.nome) === (person.nif ?? person.nome) && other.cargo === person.cargo) === index);
  return { gerentes: unique(gerentes), socios: unique(socios) };
}

export function parseMjPublication(text: string, acto = ""): MjPublication {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const bodyStart = lines.findIndex((line) => /acto de registo/i.test(line));
  const header = bodyStart >= 0 ? lines.slice(0, bodyStart) : lines;
  const body = bodyStart >= 0 ? lines.slice(bodyStart + 1) : lines;
  const registo = body.find((line) => /^(Insc|Av)\.\s*\d+/i.test(line)) ?? "";

  return {
    natureza_juridica: header.map((line) => value(line, /^Natureza Jur[íi]dica\s*:\s*(.+)$/i)).find(Boolean) ?? null,
    sede: parseSede(header),
    objeto: parseObjeto(body),
    capital: body.map((line) => value(line, /^CAPITAL\s*:\s*(.+)$/i)).find(Boolean) ?? null,
    ...parsePeople(body, `${acto} ${registo}`),
  };
}
