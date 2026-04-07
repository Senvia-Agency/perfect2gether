export interface Country {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'PT', dialCode: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: 'ES', dialCode: '+34', name: 'Espanha', flag: '🇪🇸' },
  { code: 'BR', dialCode: '+55', name: 'Brasil', flag: '🇧🇷' },
  { code: 'FR', dialCode: '+33', name: 'França', flag: '🇫🇷' },
  { code: 'DE', dialCode: '+49', name: 'Alemanha', flag: '🇩🇪' },
  { code: 'GB', dialCode: '+44', name: 'Reino Unido', flag: '🇬🇧' },
  { code: 'US', dialCode: '+1', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'IT', dialCode: '+39', name: 'Itália', flag: '🇮🇹' },
  { code: 'NL', dialCode: '+31', name: 'Países Baixos', flag: '🇳🇱' },
  { code: 'BE', dialCode: '+32', name: 'Bélgica', flag: '🇧🇪' },
  { code: 'CH', dialCode: '+41', name: 'Suíça', flag: '🇨🇭' },
  { code: 'LU', dialCode: '+352', name: 'Luxemburgo', flag: '🇱🇺' },
  { code: 'AO', dialCode: '+244', name: 'Angola', flag: '🇦🇴' },
  { code: 'MZ', dialCode: '+258', name: 'Moçambique', flag: '🇲🇿' },
  { code: 'CV', dialCode: '+238', name: 'Cabo Verde', flag: '🇨🇻' },
  { code: 'AT', dialCode: '+43', name: 'Áustria', flag: '🇦🇹' },
  { code: 'IE', dialCode: '+353', name: 'Irlanda', flag: '🇮🇪' },
  { code: 'PL', dialCode: '+48', name: 'Polónia', flag: '🇵🇱' },
  { code: 'GR', dialCode: '+30', name: 'Grécia', flag: '🇬🇷' },
  { code: 'SE', dialCode: '+46', name: 'Suécia', flag: '🇸🇪' },
  { code: 'NO', dialCode: '+47', name: 'Noruega', flag: '🇳🇴' },
  { code: 'DK', dialCode: '+45', name: 'Dinamarca', flag: '🇩🇰' },
  { code: 'FI', dialCode: '+358', name: 'Finlândia', flag: '🇫🇮' },
  { code: 'CA', dialCode: '+1', name: 'Canadá', flag: '🇨🇦' },
  { code: 'AU', dialCode: '+61', name: 'Austrália', flag: '🇦🇺' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Portugal

export function findCountryByDialCode(dialCode: string): Country | undefined {
  return COUNTRIES.find(c => dialCode.startsWith(c.dialCode));
}

export function parsePhoneNumber(fullNumber: string): { country: Country; localNumber: string } {
  if (!fullNumber) {
    return { country: DEFAULT_COUNTRY, localNumber: '' };
  }

  // Sort by dialCode length descending to match longer codes first (e.g., +351 before +3)
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  
  for (const country of sortedCountries) {
    if (fullNumber.startsWith(country.dialCode)) {
      return {
        country,
        localNumber: fullNumber.slice(country.dialCode.length),
      };
    }
  }

  return { country: DEFAULT_COUNTRY, localNumber: fullNumber.replace(/^\+/, '') };
}
