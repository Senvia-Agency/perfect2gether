import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Search } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  version: string | null;
  image_url: string | null;
  published_at: string;
}

function renderMarkdown(text: string) {
  return text
    .split("\n")
    .map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-6 mb-2">{line.slice(2)}</h1>;
      if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm text-muted-foreground list-disc">{formatInline(line.slice(2))}</li>;
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-muted-foreground">{formatInline(line)}</p>;
    });
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-medium text-foreground">{part}</strong> : part
  );
}

export default function ReleaseNotes() {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["all-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await (supabase as any)
        .from("app_announcements")
        .select("id, title, content, version, image_url, published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let result = announcements;

    // Filtro por período
    if (period !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (period) {
        case "7d": cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case "30d": cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case "90d": cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        default: cutoff = new Date(0);
      }
      result = result.filter(a => new Date(a.published_at) >= cutoff);
    }

    // Filtro por texto
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (a.version && a.version.toLowerCase().includes(q))
      );
    }

    return result;
  }, [announcements, search, period]);

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Notas de Atualização
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de atualizações e novas funcionalidades do Perfect2Gether.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por título, conteúdo ou versão..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {announcements.length === 0
                  ? "Nenhuma nota de atualização disponível."
                  : "Nenhum resultado encontrado para os filtros selecionados."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "atualização" : "atualizações"}
            </p>
            {filtered.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">{a.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(a.published_at), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </p>
                    </div>
                    {a.version && (
                      <Badge variant="secondary" className="shrink-0">{a.version}</Badge>
                    )}
                  </div>
                  {a.image_url && (
                    <img src={a.image_url} alt={a.title} className="rounded-lg w-full max-h-64 object-cover" />
                  )}
                  <div>{renderMarkdown(a.content)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
