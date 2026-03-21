import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import type cliProgress from 'cli-progress';
import { appRootDir, outputDir, recetarioCredentials, recetarioLoginUrl, recetarioNewOrderUrl } from '../config.js';
import type { CliOptions } from '../types.js';
import type { OverallProgressTracker } from '../utils/progress-bars.js';
import { writeJsonFile } from '../utils/write-json.js';

/** Selector for the visible step container */
const STEP = '.rsw_2f.rsw_3G';

const PREPAGAS_SEED_PATH = path.resolve(appRootDir, '..', 'api/scripts/seeds/prepagas.json');

// --- Types ---

interface RawTemplate {
  title: string;
  description: string;
}

interface PrepagaSeed {
  id: string;
  shortName: string;
}

interface ParsedPractice {
  name: string;
  code: string;
}

export interface PracticeRecord {
  insurerId: string;
  practiceKey: string;
  isSystem: boolean;
  code: string;
  description: string;
}

export interface PracticesBars {
  templatesBar: cliProgress.SingleBar;
}

// --- Constants ---

const SYSTEM_KEYS = new Set([
  'encounter', 'anemia', 'anticoagulation', 'compatibility',
  'hemostasis', 'myelogram', 'thrombophilia',
]);

const PRACTICE_KEYWORDS: [RegExp, string][] = [
  [/anemia/i, 'anemia'],
  [/hemostasia/i, 'hemostasis'],
  [/trombofilia/i, 'thrombophilia'],
  [/monitoreo.*aco|anticoagul/i, 'anticoagulation'],
  [/mielograma|puncion.*m\/o|p\s*m\/o/i, 'myelogram'],
  [/compatibilidad/i, 'compatibility'],
  [/consulta/i, 'encounter'],
  [/infusi[oó]n.*droga|infusion.*fe|hierro/i, 'iron_infusion'],
  [/quimioterapia|inmunoterapia/i, 'chemotherapy'],
  [/sangr[ií]a/i, 'phlebotomy'],
  [/von\s*willebrand/i, 'von_willebrand'],
  [/hematol[oó]gic/i, 'initial_studies'],
];

const PRACTICE_TITLES: Record<string, string> = {
  anemia: 'Estudio de Anemia',
  hemostasis: 'Hemostasia',
  thrombophilia: 'Estudio de Trombofilia',
  anticoagulation: 'Monitoreo de Anticoagulación',
  myelogram: 'Mielograma',
  compatibility: 'Compatibilidad',
  encounter: 'Consulta',
  iron_infusion: 'Infusión de drogas (FE) EV',
  chemotherapy: 'Sesión de quimioterapia/inmunoterapia',
  phlebotomy: 'Sangría',
  von_willebrand: 'Estudio de Von Willebrand',
  initial_studies: 'Estudios hematológicos iniciales',
};

const SKIP_DESCRIPTION_PATTERNS = [/^certifico/i, /^indico\s/i, /^dx:/i];

const SKIP_LINE_PATTERNS = [/^solicito:?\s*$/i, /^presupuesto/i, /^\s*$/];

/** Regex for a code-like token: digits, dots, dashes, slashes */
const CODE_RE = /[\d][\d.\-\/]*/;

// --- Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSkippable(entry: RawTemplate): boolean {
  const desc = entry.description.trim();
  return SKIP_DESCRIPTION_PATTERNS.some((p) => p.test(desc)) || !/\d/.test(desc);
}

/** Clean a raw code string: strip quantity suffixes, trailing dots, whitespace */
function cleanCode(raw: string): string {
  return raw
    .replace(/\.?\s*x\s*\d+\s*\([^)]*\).*$/i, '') // strip "x 1 (uno)", ". x 1 (uno)"
    .replace(/\.\s*$/, '') // trailing dot
    .trim();
}

function isCodeLine(line: string): boolean {
  const stripped = cleanCode(line);
  // A line is a "code" if it's mostly digits/dots/dashes/slashes
  return /^[\d.\-\/\s]+$/.test(stripped) && stripped.length > 0;
}

// --- Parsing ---

function parsePracticeLines(description: string): ParsedPractice[] {
  const rawLines = description
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !SKIP_LINE_PATTERNS.some((p) => p.test(l)));

  const results: ParsedPractice[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;

    // Format 1: "NAME              CODE" (same line, 2+ spaces separating)
    const sameLineMatch = line.match(/^(.+?)\s{2,}([\d][\d.\-\/]*\S*)\s*$/);
    if (sameLineMatch) {
      const code = cleanCode(sameLineMatch[2]!);
      if (code) results.push({ name: sameLineMatch[1]!.trim(), code });
      continue;
    }

    // Format 2: "CODE - NAME" (code first)
    const codeFirstMatch = line.match(/^([\d][\d.\-\/]*)\s*-\s*(.+)$/);
    if (codeFirstMatch) {
      const code = cleanCode(codeFirstMatch[1]!);
      if (code) results.push({ name: codeFirstMatch[2]!.trim(), code });
      continue;
    }

    // Format 3: "NAME - CODE" (name then dash then code)
    const nameDashCodeMatch = line.match(/^(.+?)\s*-\s*([\d][\d.\-\/]+)\s*$/);
    if (nameDashCodeMatch) {
      const code = cleanCode(nameDashCodeMatch[2]!);
      if (code) results.push({ name: nameDashCodeMatch[1]!.trim(), code });
      continue;
    }

    // Format 4: Name on this line, code(s) on next line(s)
    if (!isCodeLine(line) && CODE_RE.test(line) === false) {
      // Collect subsequent code lines
      const codes: string[] = [];
      while (i + 1 < rawLines.length) {
        const nextLine = rawLines[i + 1]!;
        if (SKIP_LINE_PATTERNS.some((p) => p.test(nextLine))) {
          i++;
          continue;
        }
        if (isCodeLine(nextLine)) {
          codes.push(cleanCode(nextLine));
          i++;
        } else {
          break;
        }
      }
      if (codes.length > 0) {
        // Join multiple code lines (e.g., SEROS has multiple slash-separated lines)
        results.push({ name: line, code: codes.join(', ') });
      }
      continue;
    }

    // If the line itself is just a code with no name, skip it
    // (already consumed by format 4)
  }

  return results;
}

/** Map a practice name to one or more practice keys */
function resolvePracticeKeys(name: string): string[] {
  const keys: string[] = [];
  for (const [regex, key] of PRACTICE_KEYWORDS) {
    if (regex.test(name)) {
      keys.push(key);
    }
  }
  return keys;
}

/** Try to match the template title against known insurer shortNames */
function resolveInsurers(title: string, prepagas: PrepagaSeed[]): PrepagaSeed[] {
  // Handle " / " separator for multiple insurers
  const segments = title.split(/\s*\/\s*/);

  const matched: PrepagaSeed[] = [];

  for (const segment of segments) {
    const upper = segment.toUpperCase().trim();

    // Also try splitting by " - " to separate insurer from practice type
    const dashParts = upper.split(/\s*-\s*/);

    // Try each part of the dash-split
    let found = false;
    for (const part of dashParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Exact match
      const exact = prepagas.find((p) => p.shortName.toUpperCase() === trimmed);
      if (exact) {
        if (!matched.some((m) => m.id === exact.id)) matched.push(exact);
        found = true;
        continue;
      }

      // Prefix match (longest first)
      const prefixMatches = prepagas
        .filter((p) => trimmed.startsWith(p.shortName.toUpperCase()))
        .sort((a, b) => b.shortName.length - a.shortName.length);

      if (prefixMatches.length > 0) {
        const best = prefixMatches[0]!;
        if (!matched.some((m) => m.id === best.id)) matched.push(best);
        found = true;
      }
    }

    // If dash-split didn't help, try the whole segment
    if (!found) {
      const exact = prepagas.find((p) => p.shortName.toUpperCase() === upper);
      if (exact && !matched.some((m) => m.id === exact.id)) {
        matched.push(exact);
        continue;
      }

      const prefixMatches = prepagas
        .filter((p) => upper.startsWith(p.shortName.toUpperCase()))
        .sort((a, b) => b.shortName.length - a.shortName.length);

      if (prefixMatches.length > 0) {
        const best = prefixMatches[0]!;
        if (!matched.some((m) => m.id === best.id)) matched.push(best);
      }
    }
  }

  return matched;
}

/** Deduplicate by insurerId + practiceKey + code */
function deduplicateRecords(records: PracticeRecord[]): PracticeRecord[] {
  const seen = new Set<string>();
  const unique: PracticeRecord[] = [];

  for (const record of records) {
    const key = `${record.insurerId}:${record.practiceKey}:${record.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(record);
    }
  }

  return unique.sort((a, b) =>
    a.insurerId.localeCompare(b.insurerId) || a.practiceKey.localeCompare(b.practiceKey)
  );
}

// --- Browser automation ---

async function clickTemplateOpen(page: Page): Promise<void> {
  await page.evaluate((step) => {
    const btn = document.querySelector<HTMLElement>(`${step} [aria-label="Open"]`);
    if (!btn) throw new Error('Open button not found in visible step');
    btn.click();
  }, STEP);
}

async function deletePracticeCard(page: Page): Promise<void> {
  await page.evaluate((step) => {
    const btn = document.querySelector<HTMLElement>(
      `${step} p + .MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium`
    );
    if (btn) btn.click();
  }, STEP);
}

async function countPracticeCards(page: Page): Promise<number> {
  return page.evaluate((step) => {
    const container = document.querySelector(step);
    if (!container) return 0;
    return container.querySelectorAll(
      'p + .MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeMedium'
    ).length;
  }, STEP);
}

async function fetchTemplates(
  browser: Browser,
  options: CliOptions,
  bars: PracticesBars,
  overall: OverallProgressTracker
): Promise<RawTemplate[]> {
  const page = await browser.newPage();

  await page.goto(recetarioLoginUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name="email"]', { timeout: 15_000 });
  await page.type('input[name="email"]', recetarioCredentials.email);
  await page.type('input[name="password"]', recetarioCredentials.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 });
  await delay(options.delayMs);

  await page.goto(recetarioNewOrderUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[role="combobox"]', { timeout: 15_000 });
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[role="combobox"]'));
    const match = inputs.find((input) => {
      const id = input.id;
      const label = id ? document.querySelector<HTMLLabelElement>(`label[for="${id}"]`) : null;
      return label?.textContent?.includes('Apellido');
    });
    match?.focus();
  });
  await page.keyboard.type('silvestre');
  await delay(2000);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await delay(options.delayMs);

  const phoneInput = await page.$('input[name="phone"]');
  if (phoneInput) {
    const phoneValue = await page.evaluate((el) => (el as HTMLInputElement).value, phoneInput);
    const cleanPhone = phoneValue.replace(/^tel:/, '');
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type(cleanPhone);
  }

  await page.click('button[type="submit"]');

  await page.waitForSelector(`${STEP} [aria-label="Open"]`, { timeout: 15_000 });
  await clickTemplateOpen(page);
  await delay(2000);

  const optionTexts = await page.evaluate(() => {
    const listbox = document.querySelector('[role="listbox"]');
    if (!listbox) return [];
    return Array.from(listbox.querySelectorAll('[role="option"]'))
      .map((o) => (o.textContent ?? '').trim())
      .filter((t) => t.length > 0);
  });

  await page.keyboard.press('Escape');
  await delay(500);

  if (optionTexts.length === 0) {
    await page.close();
    return [];
  }

  const maxTemplates = options.maxItems
    ? Math.min(options.maxItems, optionTexts.length)
    : optionTexts.length;

  bars.templatesBar.setTotal(Math.max(maxTemplates, 1));
  overall.addTotal(maxTemplates, 'Overall');

  const raw: RawTemplate[] = [];

  for (let i = 0; i < maxTemplates; i++) {
    const optionText = optionTexts[i]!;

    const cardCount = await countPracticeCards(page);
    if (cardCount >= 3) {
      await deletePracticeCard(page);
      await delay(500);
      await deletePracticeCard(page);
      await delay(500);
    }

    await clickTemplateOpen(page);
    await delay(1500);

    const clicked = await page.evaluate((targetText) => {
      const listbox = document.querySelector('[role="listbox"]');
      if (!listbox) return false;
      const opts = Array.from(listbox.querySelectorAll('[role="option"]'));
      const match = opts.find((opt) => (opt.textContent ?? '').trim() === targetText);
      if (!match) return false;
      (match as HTMLElement).click();
      return true;
    }, optionText);

    if (!clicked) {
      bars.templatesBar.increment(1, { title: `Skipped: ${optionText}` });
      overall.increment(1, 'Overall');
      continue;
    }
    await delay(options.delayMs);

    const textareaContent = await page.evaluate((step) => {
      const container = document.querySelector(step);
      if (!container) return null;
      const textareas = Array.from(container.querySelectorAll<HTMLTextAreaElement>('textarea[name^="medicines"][name$=".text"]'));
      return textareas.length > 0 ? textareas[textareas.length - 1]!.value : null;
    }, STEP);

    if (textareaContent) {
      raw.push({ title: optionText, description: textareaContent });
    }

    bars.templatesBar.increment(1, { title: `Template: ${optionText}` });
    overall.increment(1, 'Overall');
  }

  await page.close();
  return raw;
}

// --- Main entry point ---

export async function scrapePractices(
  browser: Browser,
  options: CliOptions,
  bars: PracticesBars,
  overall: OverallProgressTracker
): Promise<PracticeRecord[]> {
  // Fetch or reuse raw templates
  let raw: RawTemplate[];

  if (options.noFetch) {
    const rawPath = path.resolve(outputDir, 'practices-raw.json');
    const content = await fs.readFile(rawPath, 'utf-8');
    raw = JSON.parse(content) as RawTemplate[];
    bars.templatesBar.setTotal(1);
    bars.templatesBar.increment(1, { title: 'Using cached data' });
    overall.addTotal(1, 'Overall');
    overall.increment(1, 'Overall');
  } else {
    raw = await fetchTemplates(browser, options, bars, overall);
    await writeJsonFile(path.resolve(outputDir, 'practices-raw.json'), raw);
  }

  // Load prepagas seed for insurer resolution
  const prepagasContent = await fs.readFile(PREPAGAS_SEED_PATH, 'utf-8');
  const prepagas = JSON.parse(prepagasContent) as PrepagaSeed[];

  // Process templates
  const allRecords: PracticeRecord[] = [];
  const warnings: string[] = [];

  for (const template of raw) {
    // Skip non-practice entries
    if (isSkippable(template)) {
      warnings.push(`Skipped (not a practice): "${template.title}"`);
      continue;
    }

    // Resolve insurers
    const insurers = resolveInsurers(template.title, prepagas);
    if (insurers.length === 0) {
      warnings.push(`Unmatched insurer: "${template.title}"`);
      continue;
    }

    // Parse practices from description
    const practices = parsePracticeLines(template.description);
    if (practices.length === 0) {
      warnings.push(`No practices parsed: "${template.title}" → "${template.description.slice(0, 80)}"`);
      continue;
    }

    // Map to practice keys and emit records
    for (const practice of practices) {
      const keys = resolvePracticeKeys(practice.name);

      if (keys.length === 0) {
        warnings.push(`Unknown practice: "${practice.name}" in "${template.title}"`);
        continue;
      }

      // If multiple keys and multiple codes, zip them 1:1
      // e.g. "ANEMIA Y HEMOSTASIA" with codes "236261, 236262"
      //   → anemia=236261, hemostasis=236262
      // If counts don't match, emit a single combined key instead
      const codes = practice.code.split(/,\s*/);
      const canZip = keys.length > 1 && codes.length === keys.length;

      for (let k = 0; k < keys.length; k++) {
        const practiceKey = keys[k]!;
        const code = canZip ? codes[k]! : practice.code;
        const description = PRACTICE_TITLES[practiceKey] ?? practice.name;

        for (const insurer of insurers) {
          allRecords.push({
            insurerId: insurer.id,

            practiceKey,
            isSystem: SYSTEM_KEYS.has(practiceKey),
            code,
            description,
          });
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.error(`[practices] Warnings:\n  ${warnings.join('\n  ')}`);
  }

  const records = deduplicateRecords(allRecords);
  await writeJsonFile(path.resolve(outputDir, 'practices.json'), records);
  return records;
}
