import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { COUNTRIES, DEFAULT_COUNTRY, parsePhoneNumber, type Country } from '@/lib/countries';

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Normalize pasted phone number: clean and detect country
function normalizePastedPhone(raw: string): { country: Country; localNumber: string } {
  // Remove all non-digit characters except +
  let cleaned = raw.replace(/[^\d+]/g, '');
  
  // Convert 00 prefix to +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  
  // If starts with +, try to detect country
  if (cleaned.startsWith('+')) {
    // Try to find matching country by dial code
    for (const country of COUNTRIES) {
      const dialDigits = country.dialCode.replace('+', '');
      if (cleaned.startsWith('+' + dialDigits)) {
        const localNumber = cleaned.slice(1 + dialDigits.length);
        return { country, localNumber };
      }
    }
    // If no country found, use default and strip +
    return { country: DEFAULT_COUNTRY, localNumber: cleaned.replace('+', '') };
  }
  
  // For Portugal: if starts with 351 and has enough digits, assume it's +351
  if (cleaned.startsWith('351') && cleaned.length >= 12) {
    return { country: DEFAULT_COUNTRY, localNumber: cleaned.slice(3) };
  }
  
  // Otherwise treat as local number for default country
  return { country: DEFAULT_COUNTRY, localNumber: cleaned };
}

export function PhoneInput({ 
  value, 
  onChange, 
  placeholder = "912 345 678", 
  className,
  disabled 
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const isInternalChange = useRef(false);

  // Parse external value changes
  useEffect(() => {
    // Ignorar se a mudança foi interna (evita loop)
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    
    if (!value) {
      if (localNumber) {
        setLocalNumber('');
      }
      return;
    }
    
    const cleanNumber = localNumber.replace(/\s/g, '');
    const currentFull = cleanNumber ? `${selectedCountry.dialCode}${cleanNumber}` : '';
    
    if (value !== currentFull) {
      const { country, localNumber: parsed } = parsePhoneNumber(value);
      setSelectedCountry(country);
      setLocalNumber(parsed);
    }
  }, [value]);

  // Propagate changes to parent
  useEffect(() => {
    const cleanNumber = localNumber.replace(/\s/g, '');
    const fullNumber = cleanNumber ? `${selectedCountry.dialCode}${cleanNumber}` : '';
    
    if (fullNumber !== value) {
      isInternalChange.current = true;
      onChange(fullNumber);
    }
  }, [selectedCountry, localNumber]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\d\s]/g, '');
    setLocalNumber(cleaned);
  };

  // Handle paste with intelligent normalization
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;
    
    // Limit to reasonable phone number length
    const trimmed = pastedText.slice(0, 20);
    const { country, localNumber: normalized } = normalizePastedPhone(trimmed);
    
    setSelectedCountry(country);
    setLocalNumber(normalized);
  }, []);

  return (
    <div className={cn("flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="rounded-r-none border-r-0 px-2 h-12 min-w-fit justify-between gap-1"
            disabled={disabled}
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="text-xs text-muted-foreground">{selectedCountry.dialCode}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder="Procurar país..." />
            <CommandList>
              <CommandEmpty>País não encontrado.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} ${country.dialCode}`}
                    onSelect={() => handleCountrySelect(country)}
                    className="cursor-pointer"
                  >
                    <span className="text-base mr-2">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-muted-foreground text-sm">{country.dialCode}</span>
                    {selectedCountry.code === country.code && (
                      <Check className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Input
        type="tel"
        value={localNumber}
        onChange={handleLocalNumberChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        className="rounded-l-none flex-1"
        disabled={disabled}
      />
    </div>
  );
}
