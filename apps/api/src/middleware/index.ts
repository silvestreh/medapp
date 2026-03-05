import express from '@feathersjs/express';
import { Application } from '../declarations';
import recetarioWebhookHandler from './recetario-webhook-handler';
// Don't remove this comment. It's needed to format import lines nicely.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (app: Application): void {
  app.post(
    '/webhooks/recetario',
    (express as any).json({
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf.toString();
      },
    }),
    recetarioWebhookHandler(app) as any
  );
}
