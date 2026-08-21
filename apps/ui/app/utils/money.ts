// All payment amounts travel as integer minor units (centavos). These are the
// only conversion/formatting helpers — never hand-roll peso math in components.

export const pesosToMinor = (pesos: number): number => Math.round(pesos * 100);

export const minorToPesos = (amountMinor: number): number => amountMinor / 100;

export function formatMoneyMinor(amountMinor: number, currency = 'ARS', locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(minorToPesos(amountMinor));
}
