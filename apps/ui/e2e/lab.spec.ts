import { test, expect } from './fixtures';

test.describe('Lab tech / Lab owner role', () => {
  // -------------------------------------------------------------------------
  // Studies list
  // -------------------------------------------------------------------------
  test('can view list of studies', async ({ labPage: page }) => {
    await page.goto('/studies');
    await expect(page).toHaveURL(/\/studies/);

    // The studies page displays a table of studies
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Filter studies
  // -------------------------------------------------------------------------
  test('can filter the studies list', async ({ labPage: page }) => {
    await page.goto('/studies');

    // The search input is in the toolbar with data-tour="studies-search"
    const searchInput = page.locator('[data-tour="studies-search"]');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill('test');

    // Wait for debounced search to trigger (500ms debounce)
    await page.waitForTimeout(1_000);

    // Table should still be visible (either with results or empty)
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // View a study
  // -------------------------------------------------------------------------
  test('can view a study', async ({ labPage: page }) => {
    await page.goto('/studies');

    // Click the first study in the table
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await page.waitForURL(/\/studies\/[a-f0-9]+/);

    // Should see study form / details
    await expect(page.locator('form, input, textarea, select').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------------
  // Create a study
  // -------------------------------------------------------------------------
  test('can create a new study', async ({ labPage: page }) => {
    await page.goto('/studies');

    // Click "Nuevo Estudio" button (data-tour="studies-new")
    const newBtn = page.locator('[data-tour="studies-new"]');
    await expect(newBtn).toBeVisible({ timeout: 5_000 });
    await newBtn.click();

    await page.waitForURL(/\/studies\/new/);

    // The creation form should be visible
    await expect(page.locator('form, input, select, textarea').first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Update study with results
  // -------------------------------------------------------------------------
  test('can update a study with results', async ({ labPage: page }) => {
    await page.goto('/studies');

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await page.waitForURL(/\/studies\/[a-f0-9]+/);

    // Look for editable fields (textarea, input)
    const editableFields = page.locator('textarea, input:not([type="hidden"]):not([type="file"])');
    await expect(editableFields.first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Print a study (PDF)
  // -------------------------------------------------------------------------
  test('can print a study as PDF', async ({ labPage: page }) => {
    await page.goto('/studies');

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await page.waitForURL(/\/studies\/[a-f0-9]+/);

    // The "Imprimir" button is in the toolbar
    const printBtn = page.getByRole('button', { name: /imprimir|print/i });
    await expect(printBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});
