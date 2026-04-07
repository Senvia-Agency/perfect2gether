import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  stepNumber: number;
  title: string;
  subtitle: string;
  isCompleted: boolean;
  isActive: boolean;
  onClick?: () => void;
}

export function ImportStepHeader({ stepNumber, title, subtitle, isCompleted, isActive, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isCompleted && !isActive}
      className={cn(
        "flex items-start gap-3 w-full text-left p-4 rounded-lg transition-colors",
        isActive && "bg-accent/50",
        isCompleted && !isActive && "cursor-pointer hover:bg-accent/30",
        !isCompleted && !isActive && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
        isCompleted ? "bg-primary border-primary text-primary-foreground" :
        isActive ? "border-primary text-primary" :
        "border-muted-foreground/30 text-muted-foreground"
      )}>
        {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
      </div>
      <div className="min-w-0">
        <p className={cn("font-semibold text-sm", isActive ? "text-foreground" : "text-muted-foreground")}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}
