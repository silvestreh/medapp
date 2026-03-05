import { studySchemas, getExtraCostSections, type ExtraCostSection } from '@athelas/encounter-schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricingType = 'fixed' | 'multiplier';

export interface PricingConfig {
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
}

export type InsurerPricing = Record<string, number | PricingConfig>;
export type InsurerPrices = Record<string, InsurerPricing>;

export const PARTICULAR_INSURER_ID = '_particular';

// ---------------------------------------------------------------------------
// Pre-computed extra cost sections by study type
// ---------------------------------------------------------------------------

export const extraCostSectionsByStudyType = new Map<string, ExtraCostSection[]>();
for (const [studyName, schema] of Object.entries(studySchemas)) {
  const sections = getExtraCostSections(schema);
  if (sections.length > 0) {
    extraCostSectionsByStudyType.set(studyName, sections);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function toInsurerPrices(value: unknown): InsurerPrices {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: InsurerPrices = {};
  for (const [insurerId, insurerValue] of Object.entries(value as Record<string, unknown>)) {
    if (!insurerId || !insurerValue || typeof insurerValue !== 'object' || Array.isArray(insurerValue)) {
      continue;
    }
    result[insurerId] = insurerValue as InsurerPricing;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cost resolution
// ---------------------------------------------------------------------------

export function resolveCostFromPrice(price: number | PricingConfig | undefined): number {
  if (price == null) {
    return 0;
  }
  if (typeof price === 'number') {
    return toNonNegativeNumber(price);
  }
  if (!price || typeof price !== 'object' || Array.isArray(price)) {
    return 0;
  }

  if (price.type === 'multiplier') {
    const baseValue = toNonNegativeNumber(price.baseValue);
    const multiplier = toNonNegativeNumber(price.multiplier);
    return baseValue * multiplier;
  }

  return toNonNegativeNumber(price.value);
}

export function resolveEmergencyCostFromPrice(price: number | PricingConfig | undefined): number {
  const normalCost = resolveCostFromPrice(price);
  if (price == null || typeof price === 'number') {
    return normalCost;
  }
  if (!price || typeof price !== 'object' || Array.isArray(price)) {
    return normalCost;
  }

  let emergencyCost: number;
  if (price.type === 'multiplier') {
    const baseValue = toNonNegativeNumber(price.baseValue);
    const multiplier = toNonNegativeNumber(price.emergencyMultiplier ?? price.multiplier);
    emergencyCost = baseValue * multiplier;
  } else {
    emergencyCost = toNonNegativeNumber(price.emergencyValue ?? price.value);
  }

  return Math.max(emergencyCost, normalCost);
}

export function resolveExtraCost(
  price: number | PricingConfig | undefined,
  activeSections: string[]
): number {
  if (price == null || typeof price === 'number' || !activeSections.length) {
    return 0;
  }
  const extras = price.extras;
  if (!extras) {
    return 0;
  }

  let total = 0;
  for (const section of activeSections) {
    const extraValue = extras[section];
    if (!extraValue) continue;

    if (price.type === 'multiplier') {
      total += toNonNegativeNumber(price.baseValue) * toNonNegativeNumber(extraValue);
    } else {
      total += toNonNegativeNumber(extraValue);
    }
  }

  return total;
}

export function resolveEmergencyExtraCost(
  price: number | PricingConfig | undefined,
  activeSections: string[]
): number {
  const normalExtra = resolveExtraCost(price, activeSections);
  if (price == null || typeof price === 'number' || !activeSections.length) {
    return normalExtra;
  }
  const extras = price.emergencyExtras ?? price.extras;
  if (!extras) {
    return normalExtra;
  }

  let total = 0;
  for (const section of activeSections) {
    const extraValue = extras[section];
    if (!extraValue) continue;

    if (price.type === 'multiplier') {
      total += toNonNegativeNumber(price.baseValue) * toNonNegativeNumber(extraValue);
    } else {
      total += toNonNegativeNumber(extraValue);
    }
  }

  return Math.max(total, normalExtra);
}

export function hasAnyFieldValue(
  data: Record<string, unknown>,
  fieldNames: string[]
): boolean {
  for (const name of fieldNames) {
    const val = data[name];
    if (val != null && val !== '') {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Convenience: resolve total cost (base + extras) for a single practice
// ---------------------------------------------------------------------------

export function resolveTotalCost(opts: {
  insurerPricing: InsurerPricing | undefined;
  practiceType: string;
  emergency: boolean;
  activeSections: string[];
}): number {
  const { insurerPricing, practiceType, emergency, activeSections } = opts;
  const price = insurerPricing ? insurerPricing[practiceType] : undefined;

  const baseCost = emergency
    ? resolveEmergencyCostFromPrice(price)
    : resolveCostFromPrice(price);

  const extraCost = emergency
    ? resolveEmergencyExtraCost(price, activeSections)
    : resolveExtraCost(price, activeSections);

  return Number((baseCost + extraCost).toFixed(2));
}
