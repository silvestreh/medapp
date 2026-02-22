import type { Application } from '../../declarations';

import * as orgInviteTemplate from './templates/org-invite';
import * as orgInviteNewUserTemplate from './templates/org-invite-new-user';

const templates: Record<string, { render: (data: any) => string }> = {
  'org-invite': orgInviteTemplate,
  'org-invite-new-user': orgInviteNewUserTemplate,
};

const isProduction = process.env.NODE_ENV === 'production';

export interface MailerCreateData {
  template: string;
  to: string;
  subject: string;
  data: Record<string, any>;
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
    const { template, to, subject, data: templateData } = data;
    const tpl = templates[template];
    if (!tpl) {
      throw new Error(`Unknown email template: ${template}`);
    }

    const html = tpl.render(templateData);

    if (!isProduction) {
      console.log(`[Mailer/dev] Would send "${subject}" to ${to}`);
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

    await mg.messages.create(mailgunConfig.domain, {
      from: mailgunConfig.from,
      to: [to],
      subject,
      html,
    });

    return { sent: true };
  }
}
