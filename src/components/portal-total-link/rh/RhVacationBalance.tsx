import { Sun } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMyVacationBalance } from "@/hooks/useRhAbsences";

const formatDays = (days: number) => (days % 1 === 0 ? days.toString() : days.toFixed(1));

export default function RhVacationBalance() {
  const { data: balance, isLoading } = useMyVacationBalance();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-4 px-4 lg:px-6">
          <div className="animate-pulse h-16 bg-primary/10 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return (
      <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border">
        <CardContent className="py-4 px-4 lg:px-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-muted rounded-full shrink-0">
              <Sun className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo de Férias</p>
              <p className="text-muted-foreground mt-1 text-sm">
                O saldo de férias ainda não foi configurado para {new Date().getFullYear()}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableDays = balance.total_days - balance.used_days;

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="py-4 px-4 lg:px-6">
        <div className="flex items-start gap-3 lg:gap-4">
          <div className="p-2.5 lg:p-3 bg-primary/20 rounded-full shrink-0">
            <Sun className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">Saldo de Férias {new Date().getFullYear()}</p>
            <p className="text-xl lg:text-2xl font-semibold text-foreground mt-1">
              {formatDays(availableDays)}{" "}
              <span className="text-base lg:text-lg font-normal text-muted-foreground">dias disponíveis</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs lg:text-sm text-muted-foreground">
              <span>{formatDays(balance.total_days)} dias totais</span>
              <span>{formatDays(balance.used_days)} dias utilizados</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
