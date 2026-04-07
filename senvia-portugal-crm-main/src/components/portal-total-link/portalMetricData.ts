export type MetricView = "global" | "team";

export type TeamMetric = {
  name: string;
  objetivo: number;
  ativos: number;
  pendentes: number;
};

export type PortalMetric = {
  title: string;
  color: string;
  teamBreakdown: TeamMetric[];
  summary: {
    objetivo: number;
    ativos: number;
    pendentes: number;
  };
};

function buildMetric(
  title: string,
  color: string,
  teamBreakdown: TeamMetric[],
): PortalMetric {
  const summary = teamBreakdown.reduce(
    (acc, m) => ({
      objetivo: acc.objetivo + m.objetivo,
      ativos: acc.ativos + m.ativos,
      pendentes: acc.pendentes + m.pendentes,
    }),
    { objetivo: 0, ativos: 0, pendentes: 0 },
  );
  return { title, color, teamBreakdown, summary };
}

const defaultTeam: TeamMetric[] = [
  { name: "André Coelho", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Carla Caralinda", objetivo: 0, ativos: 67.49, pendentes: 637.48 },
  { name: "Carla Pereira", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Fernando Gama", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Jorge Henriques", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Marco Fernandes", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Nuno Miguel Campos Silva", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Parceiros", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Pedro Manuel Bento Martins", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Ricardo Cabral", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Sara Dias", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Sonia Dias", objetivo: 0, ativos: 0, pendentes: 0 },
  { name: "Susana Carapito", objetivo: 0, ativos: 676.95, pendentes: 766.26 },
  { name: "Vanda Barata", objetivo: 0, ativos: 0, pendentes: 0 },
];

export const portalHomeMetrics: PortalMetric[] = [
  buildMetric("Angariados", "hsl(var(--primary))", defaultTeam),
  buildMetric("Adicionados", "hsl(var(--secondary-foreground))", defaultTeam),
  buildMetric("Fidelizados", "hsl(var(--accent-foreground))", defaultTeam),
  buildMetric("Residêncial", "hsl(var(--muted-foreground))", defaultTeam),
  buildMetric("Novos NIFs", "hsl(var(--foreground))", defaultTeam),
];
