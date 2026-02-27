/**
 * Fetches all cuadros tarifarios from SSS API and writes them to a JSON file.
 * API: https://cuadrostarifarios.sssalud.gob.ar/api/getCuadrosTarifarios
 *
 * - Writes data to seeds/cuadros-tarifarios.json (after each page, so progress is saved).
 * - Writes last scraped page to seeds/cuadros-tarifarios-resume.json so you can resume:
 *   run again and it will continue from lastPage+1 and append to existing data.
 * - On successful completion: de-dupes by id, writes final JSON, then removes the resume file.
 *
 * Run from apps/api: pnpm run fetch:cuadros-tarifarios
 * Or: ts-node scripts/fetch-cuadros-tarifarios.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';

const BASE_URL =
  'https://cuadrostarifarios.sssalud.gob.ar/api/getCuadrosTarifarios';
const PER_PAGE = 50;
const MAX_RETRIES = 10;
const OUT_FILE = path.join(__dirname, 'seeds', 'cuadros-tarifarios.json');
const RESUME_FILE = path.join(__dirname, 'seeds', 'cuadros-tarifarios-resume.json');

interface CuadroRow {
  rn: string;
  id: number;
  rnemp: number;
  periodo: number;
  codigo_plan: number | null;
  nombre_plan: string;
  valor_capital: number;
  cantidad_capitas: number;
  rango_etario_desde: number;
  rango_etario_hasta: number;
  region: string;
  tipo_plan: string;
  comercializable: boolean;
  permite_copago: boolean;
  tasa_aumento_mensual: number;
  modalidad_adhesion: boolean;
  nombre_comercial: string;
  tipificacion: string;
  estado_nombre: string | null;
  rnemp_descripcion: string;
}

interface ApiResponse {
  data: CuadroRow[];
  paginacion: {
    total: number;
    por_pagina: number;
    pagina_actual: number;
    ultima_pagina: number;
  };
  mensaje: string;
}

async function fetchPage(page: number): Promise<ApiResponse> {
  const url = `${BASE_URL}?page=${page}&per_page=${PER_PAGE}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for page ${page}: ${await res.text()}`);
  }
  return res.json() as Promise<ApiResponse>;
}

interface ResumeState {
  lastPage: number;
  ultimaPagina: number;
}

function readResume(): ResumeState | null {
  try {
    const raw = fs.readFileSync(RESUME_FILE, 'utf-8');
    return JSON.parse(raw) as ResumeState;
  } catch {
    return null;
  }
}

function writeResume(lastPage: number, ultimaPagina: number): void {
  fs.writeFileSync(
    RESUME_FILE,
    JSON.stringify({ lastPage, ultimaPagina }, null, 2),
    'utf-8'
  );
}

async function main(): Promise<void> {
  let allData: CuadroRow[] = [];
  let page: number;
  let lastPage: number;

  const resume = readResume();
  if (resume) {
    page = resume.lastPage + 1;
    lastPage = resume.ultimaPagina;
    if (fs.existsSync(OUT_FILE)) {
      const raw = fs.readFileSync(OUT_FILE, 'utf-8');
      allData = JSON.parse(raw) as CuadroRow[];
      console.log(`Resuming from page ${page} (${allData.length} records loaded from ${OUT_FILE})`);
    } else {
      console.log(`Resuming from page ${page} (no existing data file)`);
    }
  } else {
    page = 1;
    lastPage = 0; // set from first response
  }

  let progressBar: cliProgress.SingleBar | null = null;

  console.log('Fetching cuadros tarifarios...');

  do {
    let resp: ApiResponse;
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        resp = await fetchPage(page);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          console.warn(`  page ${page} attempt ${attempt}/${MAX_RETRIES} failed, retrying in 2s: ${lastErr.message}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    if (lastErr) {
      throw lastErr;
    }
    allData.push(...resp!.data);
    lastPage = resp!.paginacion.ultima_pagina;

    if (!progressBar) {
      progressBar = new cliProgress.SingleBar(
        {
          clearOnComplete: false,
          format: '{bar} | {percentage}% | ETA: {eta_formatted} | {value}/{total} | Cuadros tarifarios',
        },
        cliProgress.Presets.shades_classic,
      );
      progressBar.start(lastPage, page);
    } else {
      progressBar.update(page);
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(allData, null, 2), 'utf-8');
    writeResume(page, lastPage);

    if (page < lastPage) {
      page++;
      await new Promise((r) => setTimeout(r, 1000));
    }
  } while (page <= lastPage);

  if (progressBar) {
    progressBar.stop();
    console.log('');
  }

  const beforeDedupe = allData.length;
  const byId = new Map<number, CuadroRow>();
  for (const row of allData) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  allData = Array.from(byId.values()).sort((a, b) => a.id - b.id);
  const removed = beforeDedupe - allData.length;
  if (removed > 0) {
    console.log(`De-duped by id: removed ${removed} duplicate(s), ${allData.length} records left`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(allData, null, 2), 'utf-8');
  if (fs.existsSync(RESUME_FILE)) {
    fs.unlinkSync(RESUME_FILE);
  }
  console.log(`Wrote ${allData.length} records to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
