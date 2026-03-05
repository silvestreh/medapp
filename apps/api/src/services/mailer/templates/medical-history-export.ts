import escape from 'escape-html';

export interface MedicalHistoryExportData {
  patientName: string;
  doctorName: string;
  organizationName: string;
  isSigned: boolean;
}

export function render(data: MedicalHistoryExportData): string {
  const patient = escape(data.patientName);
  const doctor = escape(data.doctorName);
  const orgName = escape(data.organizationName);

  const signedNote = data.isSigned
    ? '<p style="color: #16a34a; font-weight: 500;">Este documento fue firmado digitalmente y puede ser verificado en <a href="https://validadordefirmas.gob.ar/upload" style="color: #228be6;">validadordefirmas.gob.ar</a> o con Adobe Reader.</p>'
    : '<p style="color: #9ca3af; font-style: italic;">Este documento no cuenta con firma digital.</p>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Historia Clínica</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; }
    h1 { font-size: 22px; color: #1a1a1a; margin: 0 0 16px; }
    p { font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px; }
    .footer { margin-top: 32px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Historia Clínica</h1>
    <p>Adjunto encontrará la historia clínica de <strong>${patient}</strong>, generada por el Dr. <strong>${doctor}</strong> desde <strong>${orgName}</strong>.</p>
    ${signedNote}
    <p class="footer">Este email fue generado automáticamente por Athelas.</p>
  </div>
</body>
</html>`;
}
