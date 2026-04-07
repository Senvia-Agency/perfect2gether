import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn, normalizeString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  emptyValue?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Pesquisar...",
  emptyText = "Nenhum resultado encontrado.",
  emptyValue = "none",
  emptyLabel = "Nenhum",
  className,
  disabled = false,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options with accent-insensitive search
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    
    const normalizedSearch = normalizeString(search);
    return options.filter((opt) => {
      const normalizedLabel = normalizeString(opt.label);
      const normalizedSublabel = opt.sublabel ? normalizeString(opt.sublabel) : "";
      return (
        normalizedLabel.includes(normalizedSearch) ||
        normalizedSublabel.includes(normalizedSearch)
      );
    });
  }, [options, search]);

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === emptyValue) {
      onValueChange(null);
    } else {
      onValueChange(selectedValue === value ? null : selectedValue);
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.sublabel && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {selectedOption.sublabel}
                  </span>
                )}
                {selectedOption.label}
              </span>
            ) : value === null || value === emptyValue ? (
              emptyLabel
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={emptyValue}
                onSelect={() => handleSelect(emptyValue)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === null || value === emptyValue ? "opacity-100" : "opacity-0"
                  )}
                />
                {emptyLabel}
              </CommandItem>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-xs text-muted-foreground truncate">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
