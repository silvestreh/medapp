import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import type cliProgress from 'cli-progress';
import {
  alphabet,
  outputDir,
  prepagasSourceAUrl,
  prepagasSourceBUrl
} from '../config.js';
import type { CliOptions } from '../types.js';
import type { OverallProgressTracker } from '../utils/progress-bars.js';
import { normalizeForKey } from '../utils/text.js';
import { writeJsonFile } from '../utils/write-json.js';

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export type PrepagaRecord = Record<string, string | null>;
export interface PrepagaOutputRecord {
  rnas: string | null;
  enemp: string | null;
  denomination: string | null;
}
export interface PrepagasBars {
  sourceABar: cliProgress.SingleBar;
  sourceBBar: cliProgress.SingleBar;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseBestTable(page: Page): Promise<ParsedTable> {
  return page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    let bestHeaders: string[] = [];
    let bestRows: string[][] = [];
    let bestScore = -1;

    for (const table of tables) {
      const headerCells = Array.from(table.querySelectorAll('tr th')).map((cell) =>
        (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
      );
      const rowElements = Array.from(table.querySelectorAll('tr')).filter((row) => row.querySelectorAll('td').length > 0);
      const rows = rowElements.map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
      );
      const colCount = rows[0]?.length ?? headerCells.length;
      const score = rows.length * Math.max(colCount, 1);
      if (score > bestScore) {
        bestScore = score;
        bestHeaders = headerCells;
        bestRows = rows;
      }
    }

    return { headers: bestHeaders, rows: bestRows };
  });
}

async function parseTableFromSelector(page: Page, selector: string): Promise<ParsedTable | null> {
  const exists = await page.$(selector);
  if (!exists) {
    return null;
  }

  return page.$eval(selector, (table) => {
    const headers = Array.from(table.querySelectorAll('tr th')).map((cell) =>
      (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
    const rows = Array.from(table.querySelectorAll('tr'))
      .filter((row) => row.querySelectorAll('td').length > 0)
      .map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
      );
    return { headers, rows };
  });
}

function rowsToRecords(parsed: ParsedTable): PrepagaRecord[] {
  const normalizedHeaders = parsed.headers.map((header, index) => {
    if (header.length > 0) {
      return header;
    }
    return `column_${index + 1}`;
  });

  return parsed.rows.map((row) => {
    const record: PrepagaRecord = {};
    for (let index = 0; index < normalizedHeaders.length; index += 1) {
      const key = normalizedHeaders[index] ?? `column_${index + 1}`;
      const value = row[index]?.trim();
      record[key] = value && value.length > 0 ? value : null;
    }
    return record;
  });
}

function dedupePrepagas(records: PrepagaRecord[]): PrepagaRecord[] {
  const map = new Map<string, PrepagaRecord>();

  for (const record of records) {
    const entries = Object.entries(record);
    const rnasEntry = entries.find(([key, value]) => normalizeForKey(key).includes('rnas') && value);
    const denominacionEntry = entries.find(([key]) => normalizeForKey(key).includes('denominacion'));
    const domicilioEntry = entries.find(([key]) => {
      const normalized = normalizeForKey(key);
      return normalized.includes('domicilio') || normalized.includes('localidad');
    });
    const rnasKey = rnasEntry?.[1] ? normalizeForKey(rnasEntry[1]) : '';
    const fallbackKey = `${normalizeForKey(String(denominacionEntry?.[1] ?? ''))}|${normalizeForKey(String(domicilioEntry?.[1] ?? ''))}`;
    const key = rnasKey.length > 0 ? `rnas:${rnasKey}` : `fallback:${fallbackKey}`;

    if (!map.has(key)) {
      map.set(key, record);
    } else {
      const existing = map.get(key)!;
      const merged: PrepagaRecord = { ...existing };
      for (const [field, value] of Object.entries(record)) {
        if ((merged[field] === null || merged[field] === undefined) && value !== null) {
          merged[field] = value;
        }
      }
      map.set(key, merged);
    }
  }

  return Array.from(map.values());
}

function toOutputRecord(record: PrepagaRecord): PrepagaOutputRecord {
  const entries = Object.entries(record);
  const rnas = entries.find(([key]) => normalizeForKey(key) === 'rnas')?.[1] ?? null;
  const enemp =
    entries.find(([key]) => normalizeForKey(key) === 'enemp')?.[1] ??
    entries.find(([key]) => normalizeForKey(key) === 'rnemp')?.[1] ??
    null;
  const denomination =
    entries.find(([key]) => normalizeForKey(key).includes('denominacion'))?.[1] ??
    entries.find(([key]) => normalizeForKey(key).includes('denomination'))?.[1] ??
    null;

  return {
    rnas,
    enemp,
    denomination
  };
}

function dedupeOutputRecords(records: PrepagaOutputRecord[]): PrepagaOutputRecord[] {
  const map = new Map<string, PrepagaOutputRecord>();
  for (const record of records) {
    const key = record.rnas
      ? `rnas:${normalizeForKey(record.rnas)}`
      : `denomination:${normalizeForKey(record.denomination ?? '')}`;
    if (!map.has(key)) {
      map.set(key, record);
      continue;
    }

    const previous = map.get(key)!;
    map.set(key, {
      rnas: previous.rnas ?? record.rnas,
      enemp: previous.enemp ?? record.enemp,
      denomination: previous.denomination ?? record.denomination
    });
  }
  return Array.from(map.values());
}

async function querySourceAByLetter(page: Page, letter: string, delayMs: number): Promise<PrepagaRecord[]> {
  await page.goto(prepagasSourceAUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('body');

  await page.evaluate((letterValue) => {
    const input =
      document.querySelector<HTMLInputElement>('input[name="denominacion"]') ??
      document.querySelector<HTMLInputElement>('#denominacion') ??
      document.querySelector<HTMLInputElement>('input[type="text"]');

    if (!input) {
      throw new Error('Could not find search input for prepagas source A.');
    }

    input.value = letterValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const clickCandidate =
      document.querySelector<HTMLElement>('button[type="submit"]') ??
      Array.from(document.querySelectorAll<HTMLElement>('button,input[type="submit"],input[type="button"]')).find(
        (element) => (element.textContent ?? (element as HTMLInputElement).value ?? '').toLowerCase().includes('buscar')
      );

    if (clickCandidate) {
      clickCandidate.click();
      return;
    }

    const form = input.closest('form') ?? document.querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      (form as HTMLFormElement).submit();
      return;
    }

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  }, letter);

  await delay(delayMs);
  await page.waitForSelector('table,.tablaconsultas', { timeout: 15_000 });

  const fromClass = await parseTableFromSelector(page, '.tablaconsultas');
  const parsed = fromClass ?? (await parseBestTable(page));
  return rowsToRecords(parsed);
}

async function scrapeSourceA(
  page: Page,
  options: CliOptions,
  progressBar: cliProgress.SingleBar,
  overall: OverallProgressTracker
): Promise<PrepagaRecord[]> {
  const records: PrepagaRecord[] = [];
  const letters = alphabet;
  const startIndex = options.startFrom
    ? Math.max(letters.indexOf(options.startFrom.toLowerCase()), 0)
    : 0;
  const maxLetters = options.maxItems ? Math.min(options.maxItems, letters.length - startIndex) : letters.length - startIndex;
  const selectedLetters = letters.slice(startIndex, startIndex + maxLetters);
  progressBar.setTotal(selectedLetters.length);

  for (const letter of selectedLetters) {
    await delay(options.delayMs);
    const letterRecords = await querySourceAByLetter(page, letter, options.delayMs);
    records.push(...letterRecords);
    progressBar.increment(1, { title: `Prepagas A (${letter.toUpperCase()})` });
    overall.increment(1, 'Overall');
  }

  return records;
}

async function scrapeSourceB(
  page: Page,
  progressBar: cliProgress.SingleBar,
  delayMs: number,
  overall: OverallProgressTracker
): Promise<PrepagaRecord[]> {
  progressBar.setTotal(1);
  await delay(delayMs);
  await page.goto(prepagasSourceBUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('table', { timeout: 15_000 });
  const parsed = await parseBestTable(page);
  progressBar.increment(1, { title: 'Prepagas B (listado)' });
  overall.increment(1, 'Overall');
  return rowsToRecords(parsed);
}

export async function scrapePrepagas(
  browser: Browser,
  options: CliOptions,
  bars: PrepagasBars,
  overall: OverallProgressTracker
): Promise<PrepagaOutputRecord[]> {
  const page = await browser.newPage();

  const sourceARecords = await scrapeSourceA(page, options, bars.sourceABar, overall);
  const sourceBRecords = await scrapeSourceB(page, bars.sourceBBar, options.delayMs, overall);
  await page.close();

  const deduped = dedupePrepagas([...sourceARecords, ...sourceBRecords]);
  const outputRecords = dedupeOutputRecords(deduped.map(toOutputRecord));
  await writeJsonFile(path.resolve(outputDir, 'prepagas.json'), outputRecords);
  return outputRecords;
}
