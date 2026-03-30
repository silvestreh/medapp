import { AsYouType, type CountryCode } from 'libphonenumber-js';

export const COUNTRY_PHONE_OPTIONS = [
  { value: '54', label: '🇦🇷 +54', country: 'AR' as CountryCode },
  { value: '55', label: '🇧🇷 +55', country: 'BR' as CountryCode },
  { value: '56', label: '🇨🇱 +56', country: 'CL' as CountryCode },
  { value: '57', label: '🇨🇴 +57', country: 'CO' as CountryCode },
  { value: '52', label: '🇲🇽 +52', country: 'MX' as CountryCode },
  { value: '598', label: '🇺🇾 +598', country: 'UY' as CountryCode },
  { value: '595', label: '🇵🇾 +595', country: 'PY' as CountryCode },
  { value: '51', label: '🇵🇪 +51', country: 'PE' as CountryCode },
  { value: '1', label: '🇺🇸 +1', country: 'US' as CountryCode },
  { value: '34', label: '🇪🇸 +34', country: 'ES' as CountryCode },
];

export function formatPhoneForDisplay(digits: string, callingCode: string): string {
  const country = COUNTRY_PHONE_OPTIONS.find(o => o.value === callingCode)?.country || 'AR';
  const formatter = new AsYouType(country);
  // Feed the full international number so the formatter knows the format
  const formatted = formatter.input(`+${callingCode}${digits}`);
  // Strip the country code prefix from the display (e.g. "+54 " → "")
  const prefix = `+${callingCode} `;
  return formatted.startsWith(prefix)
    ? formatted.slice(prefix.length)
    : formatted.replace(`+${callingCode}`, '').trim();
}

export interface RecetarioMed {
  id: number;
  brand: string;
  drug: string;
  requiresDuplicate: boolean;
  hivSpecific: boolean;
  packages?: {
    id: number;
    name: string;
    externalId: string;
    shape?: string;
    power?: { value: string; unit: string };
  };
}

export interface RecetarioSelectedMedication {
  externalId: string;
  text: string;
  drug: string;
  brand: string;
  packageName: string;
  power: string;
  requiresDuplicate: boolean;
}

export interface MedicineRow {
  medication: RecetarioSelectedMedication | null;
  quantity: number;
  posology: string;
  longTerm: boolean;
  genericOnly: boolean;
}

export const defaultMedicine = (): MedicineRow => ({
  medication: null,
  quantity: 1,
  posology: '',
  longTerm: false,
  genericOnly: false,
});

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export const parseDate = (d: string | Date | null | undefined): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  const parsed = new Date(String(d).split('T')[0] + 'T00:00:00');
  return isNaN(parsed.getTime()) ? null : parsed;
};
