export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  isActive: boolean;
}

/**
 * Collapses tenant org rows into one row per establishment: rows sharing a
 * REFES id merge (active if any tenant is active), rows without one pass
 * through untouched. Order of first appearance is preserved.
 */
export function dedupeOrganizationRows(rows: OrganizationRow[]): OrganizationRow[] {
  const byRefes = new Map<string, OrganizationRow>();
  const result: OrganizationRow[] = [];

  for (const row of rows) {
    const refesId = row.settings?.refesId as string | undefined;
    if (!refesId) {
      result.push(row);
      continue;
    }

    const existing = byRefes.get(refesId);
    if (existing) {
      existing.isActive = existing.isActive || row.isActive;
      continue;
    }

    const merged = { ...row };
    byRefes.set(refesId, merged);
    result.push(merged);
  }

  return result;
}

export function collectRefesIds(rows: OrganizationRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const refesId = row.settings?.refesId as string | undefined;
    if (refesId) ids.add(refesId);
  }
  return Array.from(ids);
}
