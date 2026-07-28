import cron from 'node-cron';
import https from 'https';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Application, RefesEstablishment } from '../declarations';
import logger from '../logger';

/**
 * Syncs the local `refes-establishments` reference table from the Ministry
 * of Health open-data portal (datos.salud.gob.ar), which publishes the
 * REFES registry as a CKAN dataset. Unlike the SISA CommonDownloadServlet,
 * these downloads are sessionless and stable.
 */

const CKAN_PACKAGE_URL =
  'https://datos.salud.gob.ar/api/3/action/package_show?id=listado-establecimientos-de-salud-asentados-en-el-registro-federal-refes';

const CREATE_BATCH_SIZE = 1000;

// datos.salud.gob.ar serves an incomplete TLS chain (leaf only), so Node
// rejects it out of the box. We complete the chain ourselves with the
// Sectigo intermediate on top of the default root store.
const EXTRA_CA_PATH = path.join(__dirname, '../../config/certs/sectigo-dv-r36.pem');

function buildCaBundle(): string[] {
  const cas: string[] = [...tls.rootCertificates];
  try {
    cas.push(fs.readFileSync(EXTRA_CA_PATH, 'utf8'));
  } catch {
    logger.warn('REFES sync: Sectigo intermediate cert not found, TLS verification may fail');
  }
  return cas;
}

function httpsGet(url: string, redirectsLeft = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { ca: buildCaBundle() }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('REFES sync: too many redirects'));
          return;
        }
        resolve(httpsGet(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`REFES sync: HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    request.on('error', reject);
  });
}

export interface CkanResource {
  name?: string;
  format?: string;
  url?: string;
  last_modified?: string;
}

/**
 * Picks the most recent CSV resource from the dataset. Warns when an even
 * newer resource exists in a format we don't parse (e.g. XLSX), so a format
 * change on the portal doesn't go unnoticed.
 */
export function pickLatestResource(resources: CkanResource[]): CkanResource | null {
  const dated = resources.filter((r) => r.url && r.last_modified);
  const byDateDesc = [...dated].sort(
    (a, b) => String(b.last_modified).localeCompare(String(a.last_modified))
  );
  const latestCsv = byDateDesc.find((r) => String(r.format).toUpperCase() === 'CSV') || null;

  if (latestCsv && byDateDesc[0] !== latestCsv && String(byDateDesc[0].format).toUpperCase() !== 'PDF') {
    logger.warn(
      `REFES sync: newest resource "${byDateDesc[0].name}" (${byDateDesc[0].format}) is newer than the CSV in use — consider updating the parser`
    );
  }

  return latestCsv;
}

interface RefesCsvRow {
  establecimiento_id: string;
  establecimiento_nombre: string;
  localidad_id: string;
  localidad_nombre: string;
  provincia_id: string;
  provincia_nombre: string;
  departamento_id: string;
  departamento_nombre: string;
  origen_financiamiento: string;
  tipologia_id: string;
  tipologia_sigla: string;
  tipologia_nombre: string;
  cp: string;
  domicilio: string;
  sitio_web: string;
  longitud: string;
  latitud: string;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value || '').trim();
  return trimmed === '' ? null : trimmed;
}

export function parseRefesCsv(csv: string | Buffer): RefesEstablishment[] {
  const rows: RefesCsvRow[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  const establishments: RefesEstablishment[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const id = (row.establecimiento_id || '').trim();
    const name = (row.establecimiento_nombre || '').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);

    establishments.push({
      id,
      name,
      province: emptyToNull(row.provincia_nombre),
      provinceId: emptyToNull(row.provincia_id),
      department: emptyToNull(row.departamento_nombre),
      departmentId: emptyToNull(row.departamento_id),
      city: emptyToNull(row.localidad_nombre),
      cityId: emptyToNull(row.localidad_id),
      postalCode: emptyToNull(row.cp),
      address: emptyToNull(row.domicilio),
      website: emptyToNull(row.sitio_web),
      financing: emptyToNull(row.origen_financiamiento),
      typologyId: emptyToNull(row.tipologia_id),
      typologyAcronym: emptyToNull(row.tipologia_sigla),
      typologyName: emptyToNull(row.tipologia_nombre),
      longitude: emptyToNull(row.longitud),
      latitude: emptyToNull(row.latitud),
    });
  }

  return establishments;
}

/**
 * Applies a parsed registry dump: upserts every establishment (marking it
 * active and stamping lastSeenAt), then deactivates rows that were not part
 * of this dump — establishments dropped from the registry (e.g. closed
 * down) are kept resolvable by id but excluded from search.
 */
export async function applyEstablishments(
  app: Application,
  establishments: RefesEstablishment[],
  syncedAt: Date = new Date()
): Promise<{ upserted: number; deactivated: number }> {
  const service = app.service('refes-establishments');

  const rows = establishments.map((e) => ({ ...e, isActive: true, lastSeenAt: syncedAt }));
  for (let i = 0; i < rows.length; i += CREATE_BATCH_SIZE) {
    await service.bulkUpsert(rows.slice(i, i + CREATE_BATCH_SIZE));
  }

  const deactivated = await service.patch(
    null,
    { isActive: false },
    {
      query: {
        isActive: true,
        $or: [
          { lastSeenAt: null },
          { lastSeenAt: { $lt: syncedAt.toISOString() } },
        ],
      },
    }
  ) as RefesEstablishment[];

  return { upserted: rows.length, deactivated: deactivated.length };
}

export async function syncRefesEstablishments(app: Application): Promise<void> {
  logger.info('REFES sync: fetching dataset metadata');
  const packageBody = JSON.parse((await httpsGet(CKAN_PACKAGE_URL)).toString('utf8'));
  if (!packageBody.success) {
    throw new Error('REFES sync: CKAN package_show returned success=false');
  }

  const resource = pickLatestResource(packageBody.result?.resources || []);
  if (!resource || !resource.url) {
    throw new Error('REFES sync: no CSV resource found in dataset');
  }

  logger.info(`REFES sync: downloading "${resource.name}" (${resource.last_modified})`);
  const establishments = parseRefesCsv(await httpsGet(resource.url));
  if (establishments.length === 0) {
    throw new Error('REFES sync: parsed 0 establishments, aborting to keep existing data');
  }

  const { upserted, deactivated } = await applyEstablishments(app, establishments);
  logger.info(`REFES sync: upserted ${upserted} establishments, deactivated ${deactivated}`);
}

export function scheduleRefesSync(app: Application): void {
  // Weekly refresh — Mondays at 03:00
  cron.schedule('0 3 * * 1', async () => {
    try {
      await syncRefesEstablishments(app);
    } catch (error) {
      logger.error('REFES sync failed:', error);
    }
  });

  // First-run population: sync in the background when the table is empty
  (async () => {
    try {
      const existing = await app.service('refes-establishments').find({ query: { $limit: 0 } }) as { total: number };
      if (existing.total === 0) {
        logger.info('REFES sync: table empty, running initial sync');
        await syncRefesEstablishments(app);
      }
    } catch (error) {
      logger.error('REFES initial sync failed:', error);
    }
  })();
}
