// PT-PT Formatting Utilities

/**
 * Parse a localized number string (PT/EN formats) into a JS number.
 * Handles: "1.376,59" | "1 376,59" | "1,376.59" | "1376,59" | "1376.59"
 */
export function parseLocalizedNumber(value: string): number {
  if (!value || !value.trim()) return 0;
  // Remove spaces
  let cleaned = value.replace(/\s/g, '');
  // Find last comma and last dot
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    // Comma is decimal separator (PT format: 1.376,59)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot is decimal separator (EN format: 1,376.59)
    cleaned = cleaned.replace(/,/g, '');
  }
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Format date to PT-PT format (DD/MM/YYYY)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date with time to PT-PT format
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency to Euro (€)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/**
 * Format phone number for WhatsApp link
 * Removes spaces, dashes, and ensures country code
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // If Portuguese number without country code, add it
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    cleaned = '351' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format IBAN with spaces every 4 characters
 */
export function formatIban(value: string): string {
  const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

/**
 * Strip IBAN formatting for storage
 */
export function cleanIban(value: string): string {
  return value.replace(/\s/g, '');
}

/**
 * Generate WhatsApp URL
 */
export function getWhatsAppUrl(phone: string, message?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const baseUrl = `https://wa.me/${formattedPhone}`;
  
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  
  return baseUrl;
}

/**
 * Format relative time in PT-PT
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `Há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  
  return formatDate(d);
}
