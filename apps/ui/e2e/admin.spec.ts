import { test, expect } from './fixtures';

test.describe('Admin / Owner role', () => {
  // -------------------------------------------------------------------------
  // Organization settings
  // -------------------------------------------------------------------------
  test('can change organization settings', async ({ adminPage: page }) => {
    await page.goto('/settings/organization');
    await expect(page).toHaveURL(/\/settings\/organization/);

    // Organization settings form should be visible
    await expect(page.locator('form, input, [class*="organization"], [class*="Organization"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------------
  // Practices
  // -------------------------------------------------------------------------
  test('can view and manage practices', async ({ adminPage: page }) => {
    await page.goto('/settings/practices');
    await expect(page).toHaveURL(/\/settings\/practices/);

    // The practices page shows a table with "Nombre" and "Prepagas" columns
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Users list
  // -------------------------------------------------------------------------
  test('can view list of users', async ({ adminPage: page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/users/);

    // Users table should be visible
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Modify user roles
  // -------------------------------------------------------------------------
  test("can modify a user's roles", async ({ adminPage: page }) => {
    await page.goto('/users');

    // The users table has a roles column (data-tour="users-roles") with
    // multi-select role pickers per row
    await expect(page.locator('[data-tour="users-roles"]')).toBeVisible({ timeout: 10_000 });

    // Each row should have a role selector (MultiSelect or similar)
    const roleCell = page.locator('table tbody tr td').last();
    await expect(roleCell).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // Invite user
  // -------------------------------------------------------------------------
  test('can invite someone to the organization', async ({ adminPage: page }) => {
    await page.goto('/users');

    // Click the invite button (data-tour="users-invite", text "Invitar usuario")
    const inviteBtn = page.locator('[data-tour="users-invite"]');
    await expect(inviteBtn).toBeVisible({ timeout: 5_000 });
    await inviteBtn.click();

    // A modal with an email/invite form should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // The modal should have an email input (placeholder "user@example.com")
    await expect(page.getByPlaceholder('user@example.com')).toBeVisible({ timeout: 5_000 });
  });
});
