import { useDashboardPeriod } from "@/stores/useDashboardPeriod";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Printer } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";

const presets = [
  { label: "Este mês", offset: 0 },
  { label: "Mês anterior", offset: 1 },
  { label: "Há 2 meses", offset: 2 },
  { label: "Há 3 meses", offset: 3 },
];

export function DashboardPeriodFilter() {
  const { selectedMonth, setSelectedMonth } = useDashboardPeriod();
  const [open, setOpen] = useState(false);
  const now = new Date();

  const handlePreset = (offset: number) => {
    setSelectedMonth(startOfMonth(subMonths(now, offset)));
    setOpen(false);
  };

  const handlePrintAll = () => {
    const originalTitle = document.title;
    document.title = "Senvia OS";
    window.print();
    document.title = originalTitle;
  };

  const currentLabel = format(startOfMonth(selectedMonth), "MMM yyyy", { locale: pt });

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 capitalize">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b space-y-1">
            {presets.map((p) => {
              const presetDate = startOfMonth(subMonths(now, p.offset));
              const isActive =
                startOfMonth(selectedMonth).getTime() === presetDate.getTime();
              return (
                <Button
                  key={p.offset}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handlePreset(p.offset)}
                >
                  {p.label}
                  <span className="ml-auto text-xs opacity-60 capitalize">
                    {format(presetDate, "MMM yyyy", { locale: pt })}
                  </span>
                </Button>
              );
            })}
          </div>
          <Calendar
            mode="single"
            selected={startOfMonth(selectedMonth)}
            onSelect={(date) => {
              if (date) {
                setSelectedMonth(startOfMonth(date));
                setOpen(false);
              }
            }}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 no-print"
        onClick={handlePrintAll}
        title="Imprimir dashboard"
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}
