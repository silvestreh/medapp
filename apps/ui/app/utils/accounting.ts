export const PARTICULAR_INSURER_ID = '_particular';

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

export type PricingType = 'fixed' | 'multiplier';

export type PricingConfig = {
  type: PricingType;
  value?: number;
  baseValue?: number;
  multiplier?: number;
  baseName?: string;
  code?: string;
};

export type InsurerPrices = Record<string, Record<string, PricingConfig>>;

export function toNumericPrice(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Number(parsed.toFixed(2));
}

export function toPricingConfig(value: unknown): PricingConfig {
  if (typeof value === 'number') {
    return {
      type: 'fixed',
      value: toNumericPrice(value),
      baseValue: 0,
      multiplier: 1,
      baseName: '',
      code: '',
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      type: 'fixed',
      value: 0,
      baseValue: 0,
      multiplier: 1,
      baseName: '',
      code: '',
    };
  }

  const raw = value as Record<string, unknown>;
  const type: PricingType = raw.type === 'multiplier' ? 'multiplier' : 'fixed';

  return {
    type,
    value: toNumericPrice(raw.value),
    baseValue: toNumericPrice(raw.baseValue),
    multiplier: toNumericPrice(raw.multiplier ?? 1),
    baseName: typeof raw.baseName === 'string' ? raw.baseName : '',
    code: typeof raw.code === 'string' ? raw.code : '',
  };
}

export function calculatePracticeCost(value: unknown): number {
  const config = toPricingConfig(value);
  if (config.type === 'multiplier') {
    return Number((toNumericPrice(config.baseValue) * toNumericPrice(config.multiplier)).toFixed(2));
  }

  return toNumericPrice(config.value);
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

    const nextPrices: Record<string, PricingConfig> = {};
    for (const practiceKey of ACCOUNTING_PRACTICE_KEYS) {
      const raw = (prices as Record<string, unknown>)[practiceKey];
      if (raw === undefined || raw === null || raw === '') {
        continue;
      }

      nextPrices[practiceKey] = toPricingConfig(raw);
    }

    normalized[insurerId] = nextPrices;
  }

  return normalized;
}

export function resolveStudyCost(
  selectedStudies: string[],
  insurerPracticePrices: Record<string, PricingConfig> | undefined
) {
  if (!insurerPracticePrices) {
    return 0;
  }

  return Number(
    selectedStudies
      .reduce((acc, key) => acc + calculatePracticeCost(insurerPracticePrices[key]), 0)
      .toFixed(2)
  );
}
