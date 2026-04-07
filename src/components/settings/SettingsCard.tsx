import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
}

export function SettingsCard({ icon: Icon, title, description, onClick, className }: SettingsCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-lg border bg-card",
        "hover:bg-accent/50 cursor-pointer transition-colors text-left",
        className
      )}
    >
      <div className="rounded-md bg-primary/10 p-2 shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
