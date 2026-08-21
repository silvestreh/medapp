// Payment amounts travel as integer minor units (centavos). Mirror of
// apps/ui/app/utils/money.ts.

export const minorToPesos = (amountMinor: number): number => amountMinor / 100;

export function formatMoneyMinor(amountMinor: number, currency = 'ARS', locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(minorToPesos(amountMinor));
}
