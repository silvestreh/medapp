import dotenv from 'dotenv';
dotenv.config();

import helmet from 'helmet';
import cors from 'cors';
import feathers from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import express from '@feathersjs/express';
import socketio from '@feathersjs/socketio';

import { Application } from './declarations';
import logger from './logger';
import sequelize from './sequelize';
import services from './services';
import appHooks from './app.hooks';
import channels from './channels';
import authentication from './authentication';
import { setupUploadProxy } from './upload-proxy';
import { setupMobilePage } from './mobile-page';
import { setupValidatePhoto } from './validate-photo';

const app: Application = express(feathers());

app.configure(configuration());

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3030', 'http://localhost:5173'];

// Trust Railway's reverse proxy for x-forwarded-proto, x-forwarded-for, etc.
(app as any).set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/healthz', (_req: any, res: any) => {
  res.json({ ok: true });
});

// Mobile page, upload proxy, and photo validation (before feathers middleware)
setupMobilePage(app);
setupUploadProxy(app);
setupValidatePhoto(app);

app.configure(express.rest());
app.configure(socketio((io) => {
  io.origins((origin, callback) => {
    const o = origin?.trim()?.toLowerCase();

    if (corsOrigin.includes(o)) {
      return callback(null, true);
    }

    console.warn(`[Verification] Blocked connection attempt from unauthorized origin: ${origin}`);
    return callback('origin not allowed', false);
  });
}));

app.configure(sequelize);
app.configure(authentication);
app.configure(services);
app.configure(channels);

app.use(express.notFound());
app.use(express.errorHandler({ logger } as any));

app.hooks(appHooks);

export default app;
