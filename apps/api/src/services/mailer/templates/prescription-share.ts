import escape from 'escape-html';

export interface PrescriptionShareData {
  patientName: string;
  doctorName: string;
  organizationName: string;
  documentType: 'prescription' | 'order';
}

export function render(data: PrescriptionShareData): string {
  const patient = escape(data.patientName);
  const doctor = escape(data.doctorName);
  const orgName = escape(data.organizationName);
  const isOrder = data.documentType === 'order';
  const docLabel = isOrder ? 'orden médica' : 'receta';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva ${docLabel}</title>
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
    <h1>Nueva ${docLabel}</h1>
    <p>Adjunto encontrará una ${docLabel} para <strong>${patient}</strong>, emitida por ${doctor} desde <strong>${orgName}</strong>.</p>
    <p class="footer">Este email fue generado automáticamente.</p>
  </div>
</body>
</html>`;
}
