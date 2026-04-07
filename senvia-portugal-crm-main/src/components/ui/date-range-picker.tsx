import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({ 
  value, 
  onChange, 
  placeholder = "Selecionar período", 
  className 
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const formatRange = () => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, "dd/MM/yyyy", { locale: pt });
    return `${format(value.from, "dd/MM/yy", { locale: pt })} - ${format(value.to, "dd/MM/yy", { locale: pt })}`;
  };

  const hasValue = value?.from !== undefined;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className={cn(
              "justify-start text-left font-normal",
              !hasValue && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range);
              // Close popover when both dates are selected
              if (range?.from && range?.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={1}
            locale={pt}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={() => onChange(undefined)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
