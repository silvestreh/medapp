import escape from 'escape-html';

export interface PaymentFlaggedData {
  medicName: string;
  reason: 'late_payment_slot_retaken' | 'amount_mismatch' | 'charged_back';
  appointmentDate: string;
  amountFormatted: string;
}

const REASON_COPY: Record<PaymentFlaggedData['reason'], { title: string; body: string }> = {
  late_payment_slot_retaken: {
    title: 'Pago recibido para un turno vencido',
    body: 'Un paciente completó el pago después de que su reserva venciera y el horario fue tomado por otra persona. Iniciamos el reembolso automáticamente; verificá el estado en la sección de pagos y contactá al paciente para reprogramar.',
  },
  amount_mismatch: {
    title: 'Pago con monto inesperado',
    body: 'Un pago recibido no coincide con el monto calculado al reservar. El turno NO fue confirmado automáticamente. Revisalo en la sección de pagos.',
  },
  charged_back: {
    title: 'Contracargo recibido',
    body: 'Un pago de un turno recibió un contracargo. Revisá el estado en tu cuenta de Mercado Pago y en la sección de pagos.',
  },
};

export function render(data: PaymentFlaggedData): string {
  const copy = REASON_COPY[data.reason] ?? REASON_COPY.amount_mismatch;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(copy.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; }
    h1 { font-size: 22px; color: #1a1a1a; margin: 0 0 16px; }
    p { font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px; }
    .meta { font-size: 14px; color: #4a4a4a; background: #f8f9fa; border-radius: 6px; padding: 12px 16px; }
    .footer { margin-top: 32px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escape(copy.title)}</h1>
    <p>Hola ${escape(data.medicName)},</p>
    <p>${escape(copy.body)}</p>
    <p class="meta">Turno: ${escape(data.appointmentDate)}<br>Monto: ${escape(data.amountFormatted)}</p>
    <p class="footer">Esta es una notificación automática de Athelas. Athelas no interviene en el movimiento de fondos: los pagos van directamente a tu cuenta de Mercado Pago.</p>
  </div>
</body>
</html>`;
}
