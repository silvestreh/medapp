import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import type cliProgress from 'cli-progress';
import { anmatUrl, outputDir } from '../config.js';
import type { CliOptions } from '../types.js';
import { readCheckpoint, writeCheckpoint } from '../utils/checkpoints.js';
import type { OverallProgressTracker } from '../utils/progress-bars.js';
import { normalizeForKey, normalizeSpaces } from '../utils/text.js';
import { writeJsonFile } from '../utils/write-json.js';

export interface MedicationRecord {
  Nombre_Comercial_Presentacion: string | null;
  Monodroga_Generico: string | null;
  Laboratorio: string | null;
  Forma_Farmaceutica: string | null;
  Numero_Certificado: string | null;
  GTIN: string | null;
  Disponibilidad: string | null;
}
export interface MedicationsBars {
  labsBar: cliProgress.SingleBar;
  pagesBar: cliProgress.SingleBar;
}

interface MedicationsCheckpoint {
  lastLabIndex: number;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function asNullable(value: string | null | undefined): string | null {
  const cleaned = normalizeSpaces(value ?? '');
  return cleaned.length > 0 ? cleaned : null;
}

async function loadLaboratories(page: Page, delayMs: number): Promise<string[]> {
  await page.goto(anmatUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#zk_comp_40-real', { timeout: 20_000 });
  await page.click('#zk_comp_40-real');
  await delay(1000);

  const labs = new Set<string>();
  let pageGuard = 0;

  while (pageGuard < 500) {
    pageGuard += 1;

    const pageLabs = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll<HTMLTableRowElement>('#zk_comp_56 tr.z-listitem')
      );

      return rows
        .map((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          const value = (cells[2]?.textContent ?? '').replace(/\s+/g, ' ').trim();
          return value;
        })
        .filter((value) => value.length > 0);
    });

    for (const lab of pageLabs) {
      labs.add(lab);
    }

    const hasNext = await page.evaluate(() => {
      const nextButton =
        document.querySelector<HTMLElement>("#zk_comp_40-pp a[name$='-next']") ??
        document.querySelector<HTMLElement>("a[name$='-next']");
      if (!nextButton) {
        return false;
      }

      const className = (nextButton.className ?? '').toLowerCase();
      const disabled =
        className.includes('disabled') ||
        nextButton.getAttribute('aria-disabled') === 'true' ||
        nextButton.getAttribute('disabled') !== null;

      if (disabled) {
        return false;
      }

      nextButton.click();
      return true;
    });

    if (!hasNext) {
      break;
    }

    await delay(delayMs);
  }

  await page.keyboard.press('Escape');
  return Array.from(labs);
}

async function runSearch(page: Page, query: string): Promise<void> {
  await page.goto(anmatUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('body', { timeout: 20_000 });

  const labBandbox =
    (await page.$('#zk_comp_40-real')) ??
    (await page.$('input[id$="-real"]')) ??
    (await page.$('input[type="text"]'));

  if (!labBandbox) {
    throw new Error('Could not find ANMAT laboratory input.');
  }

  await labBandbox.click();
  await delay(1000);

  const popupInput =
    (await page.$('#zk_comp_53')) ??
    (await page.$('input[id$="_53"]')) ??
    (await page.$('input[id*="zk_comp_"][id$="53"]'));

  if (!popupInput) {
    throw new Error('Could not find ANMAT popup laboratory search input.');
  }

  await popupInput.click({ clickCount: 3 });
  await popupInput.type(query.slice(0, 30));
  await delay(500);

  const popupSearchButton =
    (await page.$('#zk_comp_54')) ??
    (await page.$('button[id$="_54"]')) ??
    (await page.$('button[id*="zk_comp_"][id$="54"]'));

  if (popupSearchButton) {
    await popupSearchButton.click();
  } else {
    await popupInput.press('Enter');
  }

  await delay(2000);

  const listItem =
    (await page.$('#zk_comp_56 tr.z-listitem')) ??
    (await page.$('div[id*="zk_comp_"][id$="56"] tr.z-listitem')) ??
    (await page.$('tr.z-listitem'));

  if (!listItem) {
    await page.keyboard.press('Escape');
    throw new Error(`Laboratory not found in popup list: ${query}`);
  }

  await listItem.click();
  await delay(1000);

  const mainSearchButton =
    (await page.$('#zk_comp_80')) ??
    (await page.$('button[id$="_80"]')) ??
    (await page.$('button[id*="zk_comp_"][id$="80"]'));

  if (!mainSearchButton) {
    throw new Error('Could not find ANMAT main search button.');
  }

  await mainSearchButton.click();
}

async function clickNextPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const nextButton =
      document.querySelector<HTMLElement>("div[id*='zk_comp_'] a[name$='-next']") ??
      document.querySelector<HTMLElement>("a[name$='-next']");

    if (!nextButton) {
      return false;
    }

    const disabled =
      nextButton.hasAttribute('disabled') ||
      nextButton.getAttribute('aria-disabled') === 'true' ||
      nextButton.className.toLowerCase().includes('disabled');

    if (disabled) {
      return false;
    }

    nextButton.click();
    return true;
  });
}

async function extractMedicationRowsFromResultsTable(
  page: Page,
  fallbackLaboratory: string
): Promise<MedicationRecord[]> {
  const rows = await page.evaluate(() => {
    const resultsTbody = Array.from(
      document.querySelectorAll<HTMLTableSectionElement>("div[id='zk_comp_86-body'] tbody")
    ).find((tbody) => tbody.querySelectorAll('tr.z-row').length > 0);

    if (!resultsTbody) {
      return [];
    }

    const tableRows = Array.from(resultsTbody.querySelectorAll('tr.z-row'));

    return tableRows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      const values = cells.map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim());
      const disponibilidadCell = cells[9] ?? null;
      const disponibilidad = disponibilidadCell?.querySelector('img') ? 'Disponible' : 'No disponible';

      return {
        numeroCertificado: values[1] ?? '',
        laboratorio: values[2] ?? '',
        nombreComercial: values[3] ?? '',
        formaFarmaceutica: values[4] ?? '',
        presentacion: values[5] ?? '',
        gtin: values[6] ?? '',
        generico: values[7] ?? '',
        disponibilidad
      };
    });
  });

  return rows
    .filter((row) => row.nombreComercial.length > 0 || row.generico.length > 0 || row.numeroCertificado.length > 0)
    .map((row) => {
      const commercialNamePresentation =
        row.nombreComercial && row.presentacion
          ? `${row.nombreComercial} - ${row.presentacion}`
          : row.nombreComercial || row.presentacion;

      return {
        Nombre_Comercial_Presentacion: asNullable(commercialNamePresentation),
        Monodroga_Generico: asNullable(row.generico),
        Laboratorio: asNullable(row.laboratorio) ?? asNullable(fallbackLaboratory),
        Forma_Farmaceutica: asNullable(row.formaFarmaceutica),
        Numero_Certificado: asNullable(row.numeroCertificado),
        GTIN: asNullable(row.gtin),
        Disponibilidad: asNullable(row.disponibilidad)
      };
    });
}

function dedupe(records: MedicationRecord[]): MedicationRecord[] {
  const map = new Map<string, MedicationRecord>();
  for (const record of records) {
    const key = [
      normalizeForKey(record.Nombre_Comercial_Presentacion ?? ''),
      normalizeForKey(record.Monodroga_Generico ?? ''),
      normalizeForKey(record.Laboratorio ?? ''),
      normalizeForKey(record.Numero_Certificado ?? '')
    ].join('|');
    if (!map.has(key)) {
      map.set(key, record);
    }
  }
  return Array.from(map.values());
}

export async function scrapeMedications(
  browser: Browser,
  options: CliOptions,
  bars: MedicationsBars,
  overall: OverallProgressTracker
): Promise<MedicationRecord[]> {
  const page = await browser.newPage();
  const laboratories = await loadLaboratories(page, options.delayMs);
  const checkpoint = await readCheckpoint<MedicationsCheckpoint>('medications');

  const startIndexFromFlag = options.startFrom
    ? Math.max(laboratories.indexOf(options.startFrom), 0)
    : 0;
  const startIndex = checkpoint && !options.startFrom ? checkpoint.lastLabIndex : startIndexFromFlag;
  const maxLabs = options.maxItems
    ? Math.min(options.maxItems, laboratories.length - startIndex)
    : laboratories.length - startIndex;
  const selectedLabs = laboratories.slice(startIndex, startIndex + maxLabs);

  bars.labsBar.setTotal(Math.max(selectedLabs.length, 1));
  bars.pagesBar.setTotal(1);
  bars.pagesBar.update(0, { title: 'ANMAT pages' });

  if (selectedLabs.length === 0) {
    bars.labsBar.update(1, { title: 'ANMAT labs (no labs selected)' });
    bars.pagesBar.update(1, { title: 'ANMAT pages (no results)' });
    await page.close();
    await writeJsonFile(path.resolve(outputDir, 'medications.json'), []);
    return [];
  }

  const allRows: MedicationRecord[] = [];
  let totalPages = 0;
  let pageBarTotal = 1;

  for (let index = 0; index < selectedLabs.length; index += 1) {
    const laboratory = selectedLabs[index]!;
    await delay(options.delayMs);
    try {
      await runSearch(page, laboratory);
    } catch (error) {
      bars.labsBar.increment(1, { title: `ANMAT labs (${index + 1}/${selectedLabs.length})` });
      overall.increment(1, 'Overall');
      await writeCheckpoint('medications', { lastLabIndex: startIndex + index + 1 } satisfies MedicationsCheckpoint);
      continue;
    }
    await delay(options.delayMs);

    let hasMore = true;
    let pageCounter = 0;

    while (hasMore) {
      const pageRows = await extractMedicationRowsFromResultsTable(page, laboratory);
      allRows.push(...pageRows);

      pageCounter += 1;
      totalPages += 1;
      if (totalPages > pageBarTotal) {
        pageBarTotal = totalPages;
        bars.pagesBar.setTotal(pageBarTotal);
      }
      bars.pagesBar.increment(1, { title: `ANMAT pages (${laboratory})` });

      const next = await clickNextPage(page);
      hasMore = next;
      if (hasMore) {
        await delay(options.delayMs);
      }

      if (pageRows.length === 0) {
        hasMore = false;
      }

      if (options.maxItems && pageCounter >= options.maxItems) {
        hasMore = false;
      }
    }

    bars.labsBar.increment(1, { title: `ANMAT labs (${index + 1}/${selectedLabs.length})` });
    overall.increment(1, 'Overall');
    await writeCheckpoint('medications', { lastLabIndex: startIndex + index + 1 } satisfies MedicationsCheckpoint);
  }

  if (totalPages === 0) {
    bars.pagesBar.setTotal(1);
    bars.pagesBar.update(1, { title: 'ANMAT pages (no results)' });
  }

  await page.close();
  const resultRows = dedupe(allRows);
  await writeJsonFile(path.resolve(outputDir, 'medications.json'), resultRows);
  return resultRows;
}
