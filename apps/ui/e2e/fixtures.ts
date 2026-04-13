import { test as base, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ---------------------------------------------------------------------------
// Role credentials read from e2e/.env
// ---------------------------------------------------------------------------
export type Role = 'medic' | 'lab' | 'receptionist' | 'admin';

export const credentials: Record<Role, { username: string; password: string }> = {
  medic: {
    username: process.env.MEDIC_USERNAME ?? '',
    password: process.env.MEDIC_PASSWORD ?? '',
  },
  lab: {
    username: process.env.LAB_USERNAME ?? '',
    password: process.env.LAB_PASSWORD ?? '',
  },
  receptionist: {
    username: process.env.RECEPTIONIST_USERNAME ?? '',
    password: process.env.RECEPTIONIST_PASSWORD ?? '',
  },
  admin: {
    username: process.env.ADMIN_USERNAME ?? '',
    password: process.env.ADMIN_PASSWORD ?? '',
  },
};

// ---------------------------------------------------------------------------
// Paths to persisted storage state (populated by global-setup.ts)
// ---------------------------------------------------------------------------
export const storageStatePath = (role: Role) => path.resolve(__dirname, `.auth/${role}-storage-state.json`);

// ---------------------------------------------------------------------------
// Login helper — fills the /login form and waits for redirect
// ---------------------------------------------------------------------------
export async function login(page: Page, role: Role) {
  const { username, password } = credentials[role];

  if (!username || !password) {
    throw new Error(`Missing credentials for role "${role}". Fill in e2e/.env (see e2e/.env.example).`);
  }

  await page.goto('/login');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait until we leave /login (redirect to the landing page for the role)
  await page.waitForURL(url => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Custom test fixture — provides a `loggedInPage` already authenticated
// for a given role via stored session state.
// ---------------------------------------------------------------------------
type TestFixtures = {
  medicPage: Page;
  labPage: Page;
  receptionistPage: Page;
  adminPage: Page;
};

export const test = base.extend<TestFixtures>({
  medicPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('medic') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  labPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('lab') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  receptionistPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('receptionist') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('admin') });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

// ---------------------------------------------------------------------------
// Helper — search for a patient on the encounters or patients page and click
// the first result. The search input is in the toolbar.
// ---------------------------------------------------------------------------
export async function searchAndPickFirstPatient(page: Page, query = 'a') {
  const searchInput = page.getByPlaceholder(/buscar paciente/i);
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(query);

  // Wait for a DATA row (has cursor: pointer), not the empty-state row
  const dataRow = page.locator('table tbody tr[style*="cursor"]').first();
  await expect(dataRow).toBeVisible({ timeout: 15_000 });
  await dataRow.click();
}

export { expect };
