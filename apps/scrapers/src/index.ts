import minimist from 'minimist';
import puppeteer from 'puppeteer';
import { alphabet, defaultDelayMs, estimatedAnmatLaboratories, icd10ChapterUrls } from './config.js';
import { scrapeIcd10 } from './scrapers/icd10-scraper.js';
import { scrapeMedications } from './scrapers/medications-scraper.js';
import { scrapePrepagas } from './scrapers/prepagas-scraper.js';
import type { CliOptions } from './types.js';
import { readCheckpoint } from './utils/checkpoints.js';
import { createMultiBar, createOverallProgress } from './utils/progress-bars.js';

type Command = 'prepagas' | 'medications' | 'icd10' | 'all';

interface Icd10Checkpoint {
  lastChapterIndex: number;
}

interface MedicationsCheckpoint {
  lastLabIndex: number;
}

function parseCliOptions(): { command: Command; options: CliOptions } {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['headed'],
    string: ['startFrom'],
    default: { headed: false, delayMs: defaultDelayMs }
  });

  const command = (argv._[0] as Command | undefined) ?? 'all';
  if (!['prepagas', 'medications', 'icd10', 'all'].includes(command)) {
    throw new Error(`Unsupported command "${command}". Use: prepagas | medications | icd10 | all`);
  }

  const maxItems =
    argv.maxItems !== undefined ? Number.parseInt(String(argv.maxItems), 10) : undefined;
  const parsedDelay = Number.parseInt(String(argv.delayMs), 10);

  const options: CliOptions = {
    headed: Boolean(argv.headed),
    delayMs: Math.max(2000, Number.isNaN(parsedDelay) ? defaultDelayMs : parsedDelay),
    startFrom: argv.startFrom ? String(argv.startFrom) : undefined,
    maxItems: Number.isNaN(maxItems ?? Number.NaN) ? undefined : maxItems
  };

  return { command, options };
}

async function main(): Promise<void> {
  const { command, options } = parseCliOptions();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    browser = await puppeteer.launch({
      headless: options.headed ? false : true,
      defaultViewport: { width: 1440, height: 900 }
    });
  } catch {
    browser = await puppeteer.launch({
      channel: 'chrome',
      headless: options.headed ? false : true,
      defaultViewport: { width: 1440, height: 900 }
    });
  }

  const multiBar = createMultiBar();
  const overall = createOverallProgress(multiBar);
  const runPrepagas = command === 'prepagas' || command === 'all';
  const runMedications = command === 'medications' || command === 'all';
  const runIcd10 = command === 'icd10' || command === 'all';

  const prepagasBars = runPrepagas
    ? {
        sourceABar: multiBar.create(1, 0, { title: 'Prepagas A' }),
        sourceBBar: multiBar.create(1, 0, { title: 'Prepagas B' })
      }
    : null;

  const medicationsBars = runMedications
    ? {
        labsBar: multiBar.create(1, 0, { title: 'ANMAT labs' }),
        pagesBar: multiBar.create(1, 0, { title: 'ANMAT pages' })
      }
    : null;

  const icd10Bars = runIcd10
    ? {
        chapterBar: multiBar.create(1, 0, { title: 'ICD10 chapters' })
      }
    : null;

  prepagasBars?.sourceABar.update(0, { title: 'Prepagas A' });
  prepagasBars?.sourceBBar.update(0, { title: 'Prepagas B' });
  medicationsBars?.labsBar.update(0, { title: 'ANMAT labs' });
  medicationsBars?.pagesBar.update(0, { title: 'ANMAT pages' });
  icd10Bars?.chapterBar.update(0, { title: 'ICD10 chapters' });

  const prepagasStartIndex = options.startFrom
    ? Math.max(alphabet.indexOf(options.startFrom.toLowerCase()), 0)
    : 0;
  const prepagasLetters = runPrepagas
    ? options.maxItems
      ? Math.min(options.maxItems, alphabet.length - prepagasStartIndex)
      : alphabet.length - prepagasStartIndex
    : 0;

  const icdCheckpoint = await readCheckpoint<Icd10Checkpoint>('icd10');
  const icdStartFromCheckpoint = icdCheckpoint && !options.startFrom ? icdCheckpoint.lastChapterIndex : 0;
  const icdStartFromFlag = options.startFrom
    ? Math.max(Number.parseInt(options.startFrom, 10) - 1, 0)
    : icdStartFromCheckpoint;
  const icdStartIndex = Number.isNaN(icdStartFromFlag) ? 0 : icdStartFromFlag;
  const icdUnits = runIcd10
    ? options.maxItems
      ? Math.min(options.maxItems, icd10ChapterUrls.length - icdStartIndex)
      : icd10ChapterUrls.length - icdStartIndex
    : 0;

  const medCheckpoint = await readCheckpoint<MedicationsCheckpoint>('medications');
  const medStart = medCheckpoint && !options.startFrom ? medCheckpoint.lastLabIndex : 0;
  const medsUnits = runMedications
    ? options.maxItems
      ? options.maxItems
      : Math.max(estimatedAnmatLaboratories - medStart, 0)
    : 0;

  overall.addTotal(prepagasLetters + (runPrepagas ? 1 : 0) + icdUnits + medsUnits, 'Overall');

  try {
    const tasks: Array<Promise<unknown>> = [];
    if (runPrepagas && prepagasBars) {
      tasks.push(scrapePrepagas(browser, options, prepagasBars, overall));
    }
    if (runMedications && medicationsBars) {
      tasks.push(scrapeMedications(browser, options, medicationsBars, overall));
    }
    if (runIcd10 && icd10Bars) {
      tasks.push(scrapeIcd10(browser, options, icd10Bars, overall));
    }

    await Promise.all(tasks);
  } finally {
    multiBar.stop();
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
