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

export type TierPriceOverride = {
  value?: number;
  multiplier?: number;
  extras?: Record<string, number>;
  emergencyValue?: number;
  emergencyMultiplier?: number;
  emergencyExtras?: Record<string, number>;
};

export type PricingConfig = {
  type: PricingType;
  value?: number;
  baseValue?: number;
  multiplier?: number;
  baseName?: string;
  code?: string;
  extras?: Record<string, number>;
  emergencyValue?: number;
  emergencyMultiplier?: number;
  emergencyExtras?: Record<string, number>;
  tierPrices?: Record<string, TierPriceOverride>;
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

  let extras: Record<string, number> | undefined;
  if (raw.extras && typeof raw.extras === 'object' && !Array.isArray(raw.extras)) {
    extras = {};
    for (const [k, v] of Object.entries(raw.extras as Record<string, unknown>)) {
      extras[k] = toNumericPrice(v);
    }
  }

  let emergencyExtras: Record<string, number> | undefined;
  if (raw.emergencyExtras && typeof raw.emergencyExtras === 'object' && !Array.isArray(raw.emergencyExtras)) {
    emergencyExtras = {};
    for (const [k, v] of Object.entries(raw.emergencyExtras as Record<string, unknown>)) {
      emergencyExtras[k] = toNumericPrice(v);
    }
  }

  let tierPrices: Record<string, TierPriceOverride> | undefined;
  if (raw.tierPrices && typeof raw.tierPrices === 'object' && !Array.isArray(raw.tierPrices)) {
    tierPrices = {};
    for (const [tierName, tierVal] of Object.entries(raw.tierPrices as Record<string, unknown>)) {
      if (!tierVal || typeof tierVal !== 'object' || Array.isArray(tierVal)) continue;
      const tv = tierVal as Record<string, unknown>;
      const override: TierPriceOverride = {};
      if (tv.value !== undefined) override.value = toNumericPrice(tv.value);
      if (tv.multiplier !== undefined) override.multiplier = toNumericPrice(tv.multiplier);
      if (tv.emergencyValue !== undefined) override.emergencyValue = toNumericPrice(tv.emergencyValue);
      if (tv.emergencyMultiplier !== undefined) override.emergencyMultiplier = toNumericPrice(tv.emergencyMultiplier);
      if (tv.extras && typeof tv.extras === 'object' && !Array.isArray(tv.extras)) {
        override.extras = {};
        for (const [k, v] of Object.entries(tv.extras as Record<string, unknown>)) {
          override.extras[k] = toNumericPrice(v);
        }
      }
      if (tv.emergencyExtras && typeof tv.emergencyExtras === 'object' && !Array.isArray(tv.emergencyExtras)) {
        override.emergencyExtras = {};
        for (const [k, v] of Object.entries(tv.emergencyExtras as Record<string, unknown>)) {
          override.emergencyExtras[k] = toNumericPrice(v);
        }
      }
      tierPrices[tierName] = override;
    }
    if (Object.keys(tierPrices).length === 0) tierPrices = undefined;
  }

  return {
    type,
    value: toNumericPrice(raw.value),
    baseValue: toNumericPrice(raw.baseValue),
    multiplier: toNumericPrice(raw.multiplier ?? 1),
    baseName: typeof raw.baseName === 'string' ? raw.baseName : '',
    code: typeof raw.code === 'string' ? raw.code : '',
    extras,
    emergencyValue: toNumericPrice(raw.emergencyValue),
    emergencyMultiplier: toNumericPrice(raw.emergencyMultiplier),
    emergencyExtras,
    tierPrices,
  };
}

export function calculatePracticeCost(value: unknown): number {
  const config = toPricingConfig(value);
  if (config.type === 'multiplier') {
    return Number((toNumericPrice(config.baseValue) * toNumericPrice(config.multiplier)).toFixed(2));
  }

  return toNumericPrice(config.value);
}

export function calculateExtraCost(config: PricingConfig, activeSections: string[]): number {
  if (!config.extras || activeSections.length === 0) {
    return 0;
  }

  let total = 0;
  for (const section of activeSections) {
    const extraValue = config.extras[section];
    if (!extraValue) continue;

    if (config.type === 'multiplier') {
      total += toNumericPrice(config.baseValue) * toNumericPrice(extraValue);
    } else {
      total += toNumericPrice(extraValue);
    }
  }

  return Number(total.toFixed(2));
}

export function normalizeInsurerPrices(value: unknown, extraKeys?: string[]): InsurerPrices {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const allKeys: readonly string[] = extraKeys ? [...ACCOUNTING_PRACTICE_KEYS, ...extraKeys] : ACCOUNTING_PRACTICE_KEYS;

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: InsurerPrices = {};

  for (const [insurerId, prices] of entries) {
    if (!insurerId || !prices || typeof prices !== 'object' || Array.isArray(prices)) {
      continue;
    }

    const nextPrices: Record<string, PricingConfig> = {};
    for (const practiceKey of allKeys) {
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

export function calculateEmergencyPracticeCost(value: unknown): number {
  const normalCost = calculatePracticeCost(value);
  const config = toPricingConfig(value);

  let emergencyCost: number;
  if (config.type === 'multiplier') {
    const mult = config.emergencyMultiplier ?? config.multiplier ?? 1;
    emergencyCost = Number((toNumericPrice(config.baseValue) * toNumericPrice(mult)).toFixed(2));
  } else {
    emergencyCost = toNumericPrice(config.emergencyValue ?? config.value);
  }

  return Math.max(emergencyCost, normalCost);
}

export function resolveStudyCost(
  selectedStudies: string[],
  insurerPracticePrices: Record<string, PricingConfig> | undefined,
  emergency?: boolean
) {
  if (!insurerPracticePrices) {
    return 0;
  }

  const costFn = emergency ? calculateEmergencyPracticeCost : calculatePracticeCost;

  return Number(selectedStudies.reduce((acc, key) => acc + costFn(insurerPracticePrices[key]), 0).toFixed(2));
}
