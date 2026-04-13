import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
test.describe('Login', () => {
  test('shows the login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="username"]').fill('wrong_user');
    await page.locator('input[name="password"]').fill('wrong_pass');
    await page.locator('button[type="submit"]').click();

    // Should stay on /login and display an error ("Credenciales inválidas" in Spanish)
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|credenciales|inválidas/i)).toBeVisible();
  });

  test('medic can log in and is redirected', async ({ medicPage: page }) => {
    await page.goto('/');
    // A logged-in medic lands on /encounters
    await expect(page).toHaveURL(/\/encounters/);
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
test.describe('Logout', () => {
  test('medic can log out', async ({ medicPage: page }) => {
    await page.goto('/encounters');
    await page.waitForURL(/\/encounters/);

    // Open user menu (top-right avatar trigger)
    await page.locator('[data-tour="user-menu"]').click();
    await page.getByRole('menuitem', { name: /logout|cerrar sesión|salir/i }).click();

    // Should end up on /login
    await expect(page).toHaveURL(/\/login/);
  });
});
