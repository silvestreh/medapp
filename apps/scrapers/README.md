# MedApp Scrapers

CLI scrapers for public healthcare data sources used by MedApp.

## Scrapers

- `prepagas`: scrapes SSSalud company registries and merges both sources.
- `medications`: scrapes ANMAT public medication listings.
- `icd10`: scrapes ICD-10 chapter pages in Spanish (CAP01..CAP22).

## Usage

From repository root:

```bash
pnpm --filter medapp-scrapers scrape:prepagas
pnpm --filter medapp-scrapers scrape:medications
pnpm --filter medapp-scrapers scrape:icd10
pnpm --filter medapp-scrapers scrape:all
```

Optional runtime flags:

- `--headed` open visible browser (default is headless)
- `--delayMs=<number>` delay between calls/requests (minimum enforced: `2000ms`)
- `--startFrom=<value>` resume point for long runs
- `--maxItems=<number>` cap items/pages for smoke runs

Outputs are written to `apps/scrapers/output` and are git-ignored.
