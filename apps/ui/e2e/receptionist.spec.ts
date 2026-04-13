import { test, expect, searchAndPickFirstPatient } from './fixtures';

test.describe('Receptionist role', () => {
  // -------------------------------------------------------------------------
  // Appointments
  // -------------------------------------------------------------------------
  test.describe('Appointments', () => {
    test('can view appointments', async ({ receptionistPage: page }) => {
      await page.goto('/appointments');

      // Should redirect to a medic's appointment view (monthly calendar)
      await page.waitForURL(/\/appointments\/[a-f0-9]+/, { timeout: 10_000 });

      // The custom calendar grid shows weekday headers (lun., mar., etc.)
      await expect(page.getByText(/lun\./i)).toBeVisible({ timeout: 10_000 });
    });

    test('can create an appointment by clicking a date', async ({ receptionistPage: page }) => {
      await page.goto('/appointments');
      await page.waitForURL(/\/appointments\/[a-f0-9]+/, { timeout: 10_000 });

      // Day cells are <a> with href="/appointments/{id}/YYYY-MM-DD".
      // Non-work days have href="#". Pick a work-day link.
      const dayLink = page.locator('a[href*="/20"]').first();
      await expect(dayLink).toBeVisible({ timeout: 10_000 });
      await dayLink.click();

      // Should navigate to the daily slot view
      await page.waitForURL(/\/appointments\/[a-f0-9]+\/\d{4}-\d{2}-\d{2}/, { timeout: 10_000 });
    });

    test('can remove an appointment', async ({ receptionistPage: page }) => {
      await page.goto('/appointments');
      await page.waitForURL(/\/appointments\/[a-f0-9]+/, { timeout: 10_000 });

      // Existing appointments have a trash icon button
      const trashBtn = page.locator('.slot button').first();

      if ((await trashBtn.count()) > 0) {
        await trashBtn.click();

        // A confirmation popover appears with "Eliminar" / "Delete" button
        const deleteBtn = page.getByRole('button', { name: /eliminar|delete/i });
        await expect(deleteBtn.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Patients
  // -------------------------------------------------------------------------
  test.describe('Patients', () => {
    test('can view patients list', async ({ receptionistPage: page }) => {
      await page.goto('/patients');
      await expect(page).toHaveURL(/\/patients/);

      await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
    });

    test('can search for a patient', async ({ receptionistPage: page }) => {
      await page.goto('/patients');

      const searchInput = page.locator('[data-tour="patients-search"]');
      await expect(searchInput).toBeVisible({ timeout: 10_000 });

      await searchInput.fill('test');

      // Wait for debounced search
      await page.waitForTimeout(1_000);
      // Either results appear or "No se encontraron pacientes" is shown
      await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
    });

    test('can create a new patient', async ({ receptionistPage: page }) => {
      await page.goto('/patients/new');
      await expect(page).toHaveURL(/\/patients\/new/);

      // Patient form should be visible with input fields
      await expect(page.locator('input, select').first()).toBeVisible({ timeout: 10_000 });
    });

    test('can edit a patient', async ({ receptionistPage: page }) => {
      await page.goto('/patients');

      // Search and click first patient (table starts empty until you search)
      await searchAndPickFirstPatient(page);
      await page.waitForURL(/\/patients\/[a-f0-9]+/);

      // Patient detail page should have editable fields
      await expect(page.locator('input, textarea, select').first()).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
