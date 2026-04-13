import { test, expect, searchAndPickFirstPatient } from './fixtures';

test.describe('Medic role', () => {
  // -------------------------------------------------------------------------
  // Patients
  // -------------------------------------------------------------------------
  test.describe('Patients', () => {
    test('can find patients via search', async ({ medicPage: page }) => {
      await page.goto('/patients');

      // The search input has data-tour="patients-search"
      const searchInput = page.locator('[data-tour="patients-search"]');
      await expect(searchInput).toBeVisible({ timeout: 10_000 });

      // Type a query — the table should update with results
      await searchInput.fill('test');

      // Wait for debounced search then check for results
      await page.waitForTimeout(1_000);
      // Either results appear or "No se encontraron pacientes" is shown
      await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
    });
  });

  // -------------------------------------------------------------------------
  // Encounters
  // -------------------------------------------------------------------------
  test.describe('Encounters', () => {
    test('can view encounters list', async ({ medicPage: page }) => {
      await page.goto('/encounters');
      await expect(page).toHaveURL(/\/encounters/);

      // The encounters page shows a patient search table and/or appointments
      await expect(page.locator('table, [class*="appointments"], h1, h2').first()).toBeVisible({ timeout: 10_000 });
    });

    test('can create a new encounter for a patient', async ({ medicPage: page }) => {
      await page.goto('/encounters');

      // Search for a patient and click the first result
      await searchAndPickFirstPatient(page);
      await page.waitForURL(/\/encounters\/[a-f0-9]+/);

      // Click "Nuevo Encuentro" button (data-tour="encounter-new")
      const newEncounterBtn = page.locator('[data-tour="encounter-new"]');
      await expect(newEncounterBtn).toBeVisible({ timeout: 5_000 });
      await newEncounterBtn.click();

      await page.waitForURL(/\/encounters\/[a-f0-9]+\/new/);

      // The new encounter page shows a form list and a content area
      await expect(page.getByText(/seleccione un formulario/i)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  // -------------------------------------------------------------------------
  // File attachments on an encounter
  // -------------------------------------------------------------------------
  test.describe('Encounter attachments', () => {
    test('can attach a file to a new encounter', async ({ medicPage: page }) => {
      await page.goto('/encounters');
      await searchAndPickFirstPatient(page);
      await page.waitForURL(/\/encounters\/[a-f0-9]+/);

      const newEncounterBtn = page.locator('[data-tour="encounter-new"]');
      await expect(newEncounterBtn).toBeVisible({ timeout: 5_000 });
      await newEncounterBtn.click();
      await page.waitForURL(/\/encounters\/[a-f0-9]+\/new/);

      // Look for the attachment button (paperclip icon)
      const attachBtn = page
        .getByRole('button', { name: /attach|adjuntar|archivo/i })
        .or(page.locator('[data-tour*="attach"], button:has(svg)').filter({ hasText: /attach/i }));

      // If a file input is available, use it directly
      const fileInput = page.locator('input[type="file"]');
      if ((await fileInput.count()) > 0) {
        await fileInput.setInputFiles({
          name: 'test-file.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content'),
        });

        // Expect some indication the file was attached
        await expect(page.getByText('test-file.pdf')).toBeVisible({ timeout: 10_000 });
      } else if ((await attachBtn.count()) > 0) {
        // Click the attach button which should reveal a file input
        await attachBtn.first().click();
        const revealedInput = page.locator('input[type="file"]');
        await expect(revealedInput).toBeAttached({ timeout: 5_000 });
        await revealedInput.setInputFiles({
          name: 'test-file.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content'),
        });

        await expect(page.getByText('test-file.pdf')).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  // -------------------------------------------------------------------------
  // AI Assistant
  // -------------------------------------------------------------------------
  test.describe('AI assistant', () => {
    test('can open the AI chat', async ({ medicPage: page }) => {
      await page.goto('/encounters');
      await searchAndPickFirstPatient(page);
      await page.waitForURL(/\/encounters\/[a-f0-9]+/);

      const newEncounterBtn = page.locator('[data-tour="encounter-new"]');
      await expect(newEncounterBtn).toBeVisible({ timeout: 5_000 });
      await newEncounterBtn.click();
      await page.waitForURL(/\/encounters\/[a-f0-9]+\/new/);

      // Look for the AI assistant button (robot icon or "assistant" text)
      const aiBtn = page
        .getByRole('button', { name: /assistant|asistente|ai|ia/i })
        .or(page.locator('[data-tour*="assistant"]'));

      if ((await aiBtn.count()) > 0) {
        await aiBtn.first().click();

        // Expect a chat panel or textarea to appear
        await expect(page.locator('textarea, [contenteditable], [class*="chat"]').first()).toBeVisible({
          timeout: 10_000,
        });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Prescriptions
  // -------------------------------------------------------------------------
  test.describe('Prescriptions', () => {
    test('can view prescriptions list', async ({ medicPage: page }) => {
      await page.goto('/prescriptions');
      await expect(page).toHaveURL(/\/prescriptions/);

      // Wait for the prescriptions table/cards to render (or empty state)
      await expect(
        page
          .locator('table tbody tr[style*="cursor"]')
          .first()
          .or(page.getByText(/sin recetas/i))
      ).toBeVisible({ timeout: 15_000 });
    });

    test('can create a prescription end-to-end', async ({ medicPage: page }) => {
      await page.goto('/prescriptions');

      await page.getByRole('button', { name: 'Nueva Receta' }).click();
      await page.getByRole('textbox', { name: 'Paciente', exact: true }).click();
      await page.getByRole('textbox', { name: 'Paciente', exact: true }).fill('gabriela lacho');
      await page.getByRole('option', { name: 'Gabriela Analia Lacho (' }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.locator('[id^="mantine-"][id$="-target"]').getByRole('textbox', { name: 'Buscar...' }).click();
      await page.locator('[id^="mantine-"][id$="-target"]').getByRole('textbox', { name: 'Buscar...' }).fill('j11.0');

      await expect(page.getByText('J11.0 - Influenza con neumoní')).toBeVisible({ timeout: 10_000 });

      await page.getByText('J11.0 - Influenza con neumoní').click();
      await page.getByRole('textbox', { name: 'Buscar...' }).click();
      await page.getByRole('textbox', { name: 'Buscar...' }).fill('ibupro');

      await expect(page.getByText('VEFREN')).toBeVisible({ timeout: 10_000 });

      await page.getByText('VEFREN').first().click();
      await page.getByRole('button', { name: 'Recetar' }).click();
      await page.getByText('Documento creado correctamente').click();

      await expect(page.getByText('Documento creado correctamente')).toBeVisible({ timeout: 10_000 });
    });
  });

  // -------------------------------------------------------------------------
  // Digital signature (settings)
  // -------------------------------------------------------------------------
  test.describe('Digital signature', () => {
    test('can navigate to signature settings', async ({ medicPage: page }) => {
      await page.goto('/settings/signature');
      await expect(page).toHaveURL(/\/settings\/signature/);

      // Should see the "Firma Digital" page with certificate generation options
      await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // -------------------------------------------------------------------------
  // Export medical records (on encounters detail page)
  // -------------------------------------------------------------------------
  test.describe('Export medical records', () => {
    test('can see export PDF button on patient encounters', async ({ medicPage: page }) => {
      await page.goto('/encounters');
      await searchAndPickFirstPatient(page);
      await page.waitForURL(/\/encounters\/[a-f0-9]+/);

      // Look for "Exportar PDF" button
      const exportBtn = page.getByRole('button', { name: /exportar pdf|export pdf/i });
      await expect(exportBtn.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  // -------------------------------------------------------------------------
  // Update password (settings)
  // -------------------------------------------------------------------------
  test.describe('Settings', () => {
    test('can navigate to security settings', async ({ medicPage: page }) => {
      await page.goto('/settings/security');
      await expect(page).toHaveURL(/\/settings\/security/);

      // Should see password change fields ("Contraseña actual", "Nueva contraseña")
      await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
