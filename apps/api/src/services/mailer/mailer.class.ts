import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import type { Application } from '../../declarations';

import * as orgInviteTemplate from './templates/org-invite';
import * as orgInviteNewUserTemplate from './templates/org-invite-new-user';
import * as medicalHistoryExportTemplate from './templates/medical-history-export';
import * as prescriptionShareTemplate from './templates/prescription-share';
import * as identityVerificationPendingTemplate from './templates/identity-verification-pending';
import * as passwordResetTemplate from './templates/password-reset';
import * as emailConfirmationTemplate from './templates/email-confirmation';

const templates: Record<string, { render: (data: any) => string }> = {
  'org-invite': orgInviteTemplate,
  'org-invite-new-user': orgInviteNewUserTemplate,
  'medical-history-export': medicalHistoryExportTemplate,
  'prescription-share': prescriptionShareTemplate,
  'identity-verification-pending': identityVerificationPendingTemplate,
  'password-reset': passwordResetTemplate,
  'email-confirmation': emailConfirmationTemplate,
};

const isProduction = process.env.NODE_ENV === 'production';

export interface MailerAttachment {
  filename: string;
  data: Buffer;
  contentType?: string;
}

export interface MailerCreateData {
  template: string;
  to: string;
  subject: string;
  data: Record<string, any>;
  attachments?: MailerAttachment[];
}

export interface MailerResult {
  sent: boolean;
  html?: string;
}

export class Mailer {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: MailerCreateData): Promise<MailerResult> {
    const { template, to, subject, data: templateData, attachments } = data;
    const tpl = templates[template];
    if (!tpl) {
      throw new Error(`Unknown email template: ${template}`);
    }

    const html = tpl.render(templateData);

    if (!isProduction) {
      console.log(`[Mailer/dev] Would send "${subject}" to ${to}`);

      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const tmpDir = path.join(require('os').tmpdir(), 'athelas-emails');
        fs.mkdirSync(tmpDir, { recursive: true });
        const filename = `${template}-${Date.now()}.html`;
        const filepath = path.join(tmpDir, filename);
        fs.writeFileSync(filepath, html);
        exec(`open "${filepath}"`);
      }

      return { sent: false, html };
    }

    const mailgunConfig = this.app.get('mailgun') as {
      apiKey: string;
      domain: string;
      from: string;
    } | undefined;

    if (!mailgunConfig?.apiKey || !mailgunConfig?.domain) {
      console.warn('[Mailer] Mailgun not configured, skipping email send');
      return { sent: false, html };
    }

    const FormData = (await import('form-data')).default;
    const Mailgun = (await import('mailgun.js')).default;
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: 'api',
      key: mailgunConfig.apiKey,
    });

    const messageData: any = {
      from: mailgunConfig.from,
      to: [to],
      subject,
      html,
    };

    if (attachments?.length) {
      messageData.attachment = attachments.map((att) => ({
        filename: att.filename,
        data: att.data,
        contentType: att.contentType || 'application/octet-stream',
      }));
    }

    await mg.messages.create(mailgunConfig.domain, messageData);

    return { sent: true };
  }
}
