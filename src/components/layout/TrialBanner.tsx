import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface TrialBannerProps {
  daysRemaining: number;
  totalDays?: number;
}

export function TrialBanner({ daysRemaining, totalDays = 14 }: TrialBannerProps) {
  const navigate = useNavigate();
  const elapsed = totalDays - daysRemaining;
  const progress = Math.round((elapsed / totalDays) * 100);

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* Left: icon + text */}
        <div className="flex items-center gap-2 shrink-0">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary">
            Período de teste: {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
          </span>
        </div>

        {/* Center: progress bar */}
        <Progress value={progress} className="h-1.5 flex-1 min-w-[80px] bg-primary/15 [&>div]:bg-primary" />

        {/* Right: CTA button */}
        <Button
          variant="senvia"
          size="sm"
          className="h-7 text-xs px-3 shrink-0"
          onClick={() => navigate('/settings?tab=billing')}
        >
          Escolher Plano
        </Button>
      </div>
    </div>
  );
}
