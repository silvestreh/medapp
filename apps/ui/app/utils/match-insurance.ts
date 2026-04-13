export interface RecetarioInsurance {
  id: number;
  name: string;
}

export interface InsuranceMatchResult {
  matchType: 'exact' | 'partial' | 'none';
  matchedName: string | null;
}

export function matchInsurance(shortName: string, insurances: RecetarioInsurance[]): InsuranceMatchResult {
  if (!shortName) return { matchType: 'none', matchedName: null };
  const needle = shortName.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exact = insurances.find(i => i.name.toLowerCase().trim() === needle);
  if (exact) {
    return { matchType: 'exact', matchedName: exact.name };
  }

  // Partial match: needle is contained in an insurance name, or vice versa
  const partial = insurances.find(i => {
    const haystack = i.name.toLowerCase().trim();
    return haystack.includes(needle) || needle.includes(haystack);
  });

  if (partial) {
    return { matchType: 'partial', matchedName: partial.name };
  }

  return { matchType: 'none', matchedName: null };
}
