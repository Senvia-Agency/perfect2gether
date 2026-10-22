import type { Json } from "@/integrations/supabase/types";

export interface MjPerson {
  nome: string;
  nif: string | null;
  cargo: string;
  email: string | null;
}

export interface MjCompanyData {
  acto: string | null;
  publicationDate: string | null;
  naturezaJuridica: string | null;
  morada: string | null;
  codigoPostal: string | null;
  localidade: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
  objeto: string | null;
  capital: string | null;
  caePrincipal: string | null;
  caeSecundarios: string[];
  gerentes: MjPerson[];
  socios: MjPerson[];
}

type JsonRecord = Record<string, Json | undefined>;

const isRecord = (value: Json | undefined): value is JsonRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: Json | undefined): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

function people(value: Json | undefined): MjPerson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !text(item.nome)) return [];
    return [{ nome: text(item.nome) ?? "", nif: text(item.nif), cargo: text(item.cargo) ?? "", email: text(item.email) }];
  });
}

export function readMjCompanyData(metadata: unknown): MjCompanyData | null {
  const candidate = metadata as Json | undefined;
  if (!isRecord(candidate) || candidate.source_portal !== "publicacoes.mj.pt") return null;
  const meta = candidate;
  const sede = isRecord(meta.sede) ? meta.sede : {};
  const cae = isRecord(meta.cae) ? meta.cae : {};
  return {
    acto: text(meta.acto),
    publicationDate: text(meta.publication_date),
    naturezaJuridica: text(meta.natureza_juridica),
    morada: text(sede.morada),
    codigoPostal: text(sede.codigo_postal),
    localidade: text(sede.localidade),
    freguesia: text(sede.freguesia),
    concelho: text(sede.concelho),
    distrito: text(sede.distrito),
    objeto: text(meta.objeto),
    capital: text(meta.capital),
    caePrincipal: text(cae.principal),
    caeSecundarios: Array.isArray(cae.secundarios) ? cae.secundarios.flatMap((code) => (text(code) ? [text(code) as string] : [])) : [],
    gerentes: people(meta.gerentes),
    socios: people(meta.socios),
  };
}

export function mjLocation(data: MjCompanyData): string | null {
  return [data.concelho, data.distrito].filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join(", ") || null;
}
