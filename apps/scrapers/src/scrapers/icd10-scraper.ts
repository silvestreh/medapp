import path from 'node:path';
import type { Browser } from 'puppeteer';
import type cliProgress from 'cli-progress';
import { icd10ChapterUrls, outputDir } from '../config.js';
import type { CliOptions } from '../types.js';
import { readCheckpoint, writeCheckpoint } from '../utils/checkpoints.js';
import type { OverallProgressTracker } from '../utils/progress-bars.js';
import { decodeBrokenCharacters, normalizeSpaces } from '../utils/text.js';
import { writeJsonFile } from '../utils/write-json.js';

export interface Icd10Record {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
  level: number;
}
export interface Icd10Bars {
  chapterBar: cliProgress.SingleBar;
}

interface Icd10Checkpoint {
  lastChapterIndex: number;
}

interface CodeRange {
  code: string;
  start: string;
  end: string;
}

const codeLineRegex =
  /^([A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?(?:\s*-\s*[A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?)?)\s+(.+)$/;

function normalizeCode(rawCode: string): string {
  return rawCode.replace(/\s+/g, '').replace(/‑|–|—/g, '-').trim();
}

function parseRange(code: string): CodeRange | null {
  if (!code.includes('-')) {
    return null;
  }
  const [start, end] = code.split('-');
  if (!start || !end) {
    return null;
  }
  return { code, start, end };
}

function codeToComparable(code: string): string {
  return code.replace('.', '').padEnd(5, '0');
}

function isInRange(code: string, range: CodeRange): boolean {
  const value = codeToComparable(code);
  return value >= codeToComparable(range.start) && value <= codeToComparable(range.end);
}

function inferLevel(code: string): number {
  if (code.includes('.')) {
    return 2;
  }
  if (code.includes('-')) {
    return 0;
  }
  return 1;
}

function parseCodeLines(text: string): Array<Omit<Icd10Record, 'children'>> {
  const lines = decodeBrokenCharacters(text)
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter((line) => line.length > 0);

  const results: Array<Omit<Icd10Record, 'children'>> = [];
  const ranges: CodeRange[] = [];

  for (const line of lines) {
    const match = line.match(codeLineRegex);
    if (!match) {
      continue;
    }

    const code = normalizeCode(match[1]!);
    const name = normalizeSpaces(match[2]!);
    const level = inferLevel(code);
    let parent: string | null = null;

    if (code.includes('.')) {
      parent = code.slice(0, 3);
    } else if (!code.includes('-')) {
      const containing = [...ranges].reverse().find((range) => isInRange(code, range));
      parent = containing?.code ?? null;
    }

    const range = parseRange(code);
    if (range) {
      ranges.push(range);
    }

    results.push({
      id: code,
      name,
      parent,
      level
    });
  }

  return results;
}

function mergeRecords(records: Array<Omit<Icd10Record, 'children'>>): Icd10Record[] {
  const map = new Map<string, Icd10Record>();
  for (const record of records) {
    const existing = map.get(record.id);
    if (!existing) {
      map.set(record.id, { ...record, children: [] });
      continue;
    }

    if (record.name.length > existing.name.length) {
      existing.name = record.name;
    }

    if (!existing.parent && record.parent) {
      existing.parent = record.parent;
    }
  }

  for (const record of map.values()) {
    if (record.parent && map.has(record.parent)) {
      map.get(record.parent)!.children.push(record.id);
    }
  }

  for (const record of map.values()) {
    record.children = Array.from(new Set(record.children)).sort((a, b) => a.localeCompare(b));
  }

  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export async function scrapeIcd10(
  browser: Browser,
  options: CliOptions,
  bars: Icd10Bars,
  overall: OverallProgressTracker
): Promise<Icd10Record[]> {
  const page = await browser.newPage();
  const checkpoint = await readCheckpoint<Icd10Checkpoint>('icd10');

  const startFromCheckpoint = checkpoint && !options.startFrom ? checkpoint.lastChapterIndex : 0;
  const startFromFlag = options.startFrom
    ? Math.max(Number.parseInt(options.startFrom, 10) - 1, 0)
    : startFromCheckpoint;
  const startIndex = Number.isNaN(startFromFlag) ? 0 : startFromFlag;

  const maxChapters = options.maxItems
    ? Math.min(options.maxItems, icd10ChapterUrls.length - startIndex)
    : icd10ChapterUrls.length - startIndex;
  const selectedChapters = icd10ChapterUrls.slice(startIndex, startIndex + maxChapters);

  bars.chapterBar.setTotal(Math.max(selectedChapters.length, 1));
  const allParsed: Array<Omit<Icd10Record, 'children'>> = [];

  for (let index = 0; index < selectedChapters.length; index += 1) {
    const chapterUrl = selectedChapters[index]!;
    const chapter = startIndex + index + 1;
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await page.goto(chapterUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('body', { timeout: 20_000 });
    const text = await page.$eval('body', (element) => element.innerText);
    const parsed = parseCodeLines(text);
    allParsed.push(...parsed);

    bars.chapterBar.increment(1, { title: `ICD10 chapter CAP${String(chapter).padStart(2, '0')}` });
    overall.increment(1, 'Overall');
    await writeCheckpoint('icd10', { lastChapterIndex: startIndex + index + 1 } satisfies Icd10Checkpoint);
  }

  await page.close();
  const merged = mergeRecords(allParsed);
  await writeJsonFile(path.resolve(outputDir, 'icd10-es.json'), merged);
  return merged;
}
