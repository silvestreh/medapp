export const ACCOUNTING_PRACTICE_KEYS = [
  'encounter',
  'anemia',
  'anticoagulation',
  'compatibility',
  'hemostasis',
  'myelogram',
  'thrombophilia',
] as const;

export type AccountingPracticeKey = (typeof ACCOUNTING_PRACTICE_KEYS)[number];

export type InsurerPrices = Record<string, Record<string, number>>;

export function toNumericPrice(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Number(parsed.toFixed(2));
}

export function normalizeInsurerPrices(value: unknown): InsurerPrices {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: InsurerPrices = {};

  for (const [insurerId, prices] of entries) {
    if (!insurerId || !prices || typeof prices !== 'object' || Array.isArray(prices)) {
      continue;
    }

    const nextPrices: Record<string, number> = {};
    for (const practiceKey of ACCOUNTING_PRACTICE_KEYS) {
      const raw = (prices as Record<string, unknown>)[practiceKey];
      if (raw === undefined || raw === null || raw === '') {
        continue;
      }

      nextPrices[practiceKey] = toNumericPrice(raw);
    }

    normalized[insurerId] = nextPrices;
  }

  return normalized;
}

export function parsePrepagaDisplay(value: string | null | undefined) {
  if (!value) {
    return { shortName: '', denomination: '' };
  }

  const [shortNameRaw, ...rest] = value.split('/');
  return {
    shortName: shortNameRaw?.trim() || '',
    denomination: rest.join('/').trim(),
  };
}

export function resolveStudyCost(selectedStudies: string[], insurerPracticePrices: Record<string, number> | undefined) {
  if (!insurerPracticePrices) {
    return 0;
  }

  return Number(
    selectedStudies
      .reduce((acc, key) => acc + toNumericPrice(insurerPracticePrices[key]), 0)
      .toFixed(2)
  );
}
