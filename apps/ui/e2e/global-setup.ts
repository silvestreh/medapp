import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentials, login, storageStatePath, type Role } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.resolve(__dirname, '.auth');

// Ensure the .auth directory exists
setup.beforeAll(() => {
  fs.mkdirSync(authDir, { recursive: true });
});

// Authenticate each role that has credentials configured and persist the
// browser storage state so that subsequent tests can skip the login form.
const roles: Role[] = ['medic', 'lab', 'receptionist', 'admin'];

for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { username, password } = credentials[role];

    if (!username || !password) {
      setup.skip();
      return;
    }

    await login(page, role);
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
