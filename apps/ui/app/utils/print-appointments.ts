import dayjs from 'dayjs';
import type { Slot } from '~/declarations';
import { getMedicareLabel } from '~/components/medicare-display';
import { printHtmlContent } from '~/utils/print-pdf';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRow(time: string, timeBg: string, content: string): string {
  return `<tr>
    <td style="padding:8px 12px;background:${timeBg};font-family:monospace;color:rgba(0,0,0,0.5);white-space:nowrap">${time}</td>
    <td style="padding:8px 12px">${content}</td>
  </tr>`;
}

export function printAppointments(
  slots: Slot[],
  title: string,
  freeLabel: string,
  privateLabel: string,
): void {
  const rows = slots
    .map(slot => {
      const time = slot.appointment?.extra ? 'ST' : dayjs(slot.date).format('HH:mm');
      const timeBg = slot.appointment?.extra ? '#FFF9DB' : '#E7F5FF';

      if (!slot.appointment) {
        return buildRow(time, timeBg, `<span style="color:#ADB5BD">${escapeHtml(freeLabel)}</span>`);
      }

      const { lastName, firstName } = slot.appointment.patient.personalData;
      const insurance = getMedicareLabel(slot.appointment.patient) || privateLabel;

      return buildRow(
        time,
        timeBg,
        `<strong>${escapeHtml(lastName.toUpperCase())}</strong>, ${escapeHtml(firstName)}<br/>
        <span style="color:#868E96;font-size:0.85em">${escapeHtml(insurance)}</span>`,
      );
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head>
<body style="font-family:sans-serif;margin:2rem">
  <h2 style="margin-bottom:1rem">${escapeHtml(title)}</h2>
  <table style="width:100%;border-collapse:collapse">
    ${rows}
  </table>
</body></html>`;

  printHtmlContent(html);
}
