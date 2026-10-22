import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ProspectJobProgress as Progression } from "@/hooks/useProspects";

interface ProspectJobProgressProps {
  title: string;
  progress: Progression;
  hint: string;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

export function ProspectJobProgress({ title, progress, hint }: ProspectJobProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {title}
        </span>
        <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} className="h-2 bg-primary/15" aria-label={`${progress.percent}% concluído`} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{progress.label}</span>
        <span className="tabular-nums">{formatElapsed(elapsed)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
