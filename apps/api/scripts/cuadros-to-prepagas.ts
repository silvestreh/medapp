/**
 * Reads cuadros-tarifarios.json and outputs prepagas in the same shape as
 * prepagas.json, with registry (single key), denomination, shortName, and
 * tiers as { name, code }[] deduped by (codigo_plan, nombre_plan) per insurer.
 *
 * Run from apps/api: pnpm run cuadros-to-prepagas
 * Or: ts-node scripts/cuadros-to-prepagas.ts
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const CUADROS_FILE = path.join(__dirname, 'seeds', 'cuadros-tarifarios.json');
const OUT_FILE = path.join(__dirname, 'seeds', 'prepagas-from-cuadros.json');

interface CuadroRow {
  rn: string;
  id: number;
  rnemp: number;
  periodo: number;
  codigo_plan: number | null;
  nombre_plan: string;
  nombre_comercial: string;
  rnemp_descripcion: string;
  [key: string]: unknown;
}

interface TierEntry {
  name: string;
  code: number | null;
}

interface PrepagaFromCuadros {
  id: string;
  registry: string;
  denomination: string;
  shortName: string;
  tiers: TierEntry[];
}

function deterministicId(registry: string): string {
  const h = crypto.createHash('sha256').update(registry).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function run(): void {
  console.log(`Reading ${CUADROS_FILE}...`);
  const raw = fs.readFileSync(CUADROS_FILE, 'utf-8');
  const rows = JSON.parse(raw) as CuadroRow[];

  const byRnemp = new Map<
    number,
    { denomination: string; shortName: string; tierKeys: Set<string>; tiers: TierEntry[] }
  >();

  for (const row of rows) {
    const registry = `rnemp:${row.rnemp}`;
    let entry = byRnemp.get(row.rnemp);
    if (!entry) {
      entry = {
        denomination: row.rnemp_descripcion,
        shortName: row.nombre_comercial,
        tierKeys: new Set(),
        tiers: [],
      };
      byRnemp.set(row.rnemp, entry);
    }

    const tierKey = `${row.codigo_plan}:${row.nombre_plan}`;
    if (!entry.tierKeys.has(tierKey)) {
      entry.tierKeys.add(tierKey);
      entry.tiers.push({ name: row.nombre_plan, code: row.codigo_plan });
    }
  }

  const out: PrepagaFromCuadros[] = [];
  for (const [rnemp, entry] of byRnemp.entries()) {
    const registry = `rnemp:${rnemp}`;
    out.push({
      id: deterministicId(registry),
      registry,
      denomination: entry.denomination,
      shortName: entry.shortName,
      tiers: entry.tiers.sort((a, b) => {
        const c = (a.code ?? 0) - (b.code ?? 0);
        return c !== 0 ? c : a.name.localeCompare(b.name);
      }),
    });
  }

  out.sort((a, b) => a.denomination.localeCompare(b.denomination));

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`Wrote ${out.length} insurers to ${OUT_FILE}`);
}

run();
