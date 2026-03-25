import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
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
import { setupWidgetPage } from './widget-page';
import { setupAdminPage } from './admin-page';
import { setupValidatePhoto } from './validate-photo';
import { setupRunChecks } from './run-checks';
import { setupAutoCheckProgress } from './auto-check-progress';
import { decryptFileFromDisk } from './file-storage';

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

// Serve static files (styles.css, etc.)
(app as any).use('/public', require('express').static(path.resolve(__dirname, '../public')));

app.get('/healthz', (_req: any, res: any) => {
  res.json({ ok: true });
});

// Serve decrypted uploads (requires API key for service-to-service access)
(app as any).get('/uploads/:filename', async (req: any, res: any) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.UPLOADS_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const uploadsDir = app.get('uploads')?.dir || './uploads';
    const filename = req.params.filename;

    // Derive content type from the original extension (e.g. uuid.jpg.enc → jpg)
    const ext = filename.replace(/\.enc$/, '').split('.').pop();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
      webm: 'video/webm', mp4: 'video/mp4',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    const decrypted = decryptFileFromDisk(uploadsDir, `/uploads/${filename}`);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, no-store');
    res.send(decrypted);
  } catch (error: any) {
    logger.error('[uploads] Decrypt error: %s', error.message);
    res.status(404).json({ message: 'File not found' });
  }
});

// Mobile page, widget, upload proxy, and photo validation (before feathers middleware)
setupMobilePage(app);
setupWidgetPage(app);
setupAdminPage(app);
setupUploadProxy(app);
setupValidatePhoto(app);
setupRunChecks(app);
setupAutoCheckProgress(app);

app.configure(express.rest());
app.configure(socketio((io) => {
  io.origins((origin, callback) => {
    const o = origin?.trim()?.toLowerCase();
    logger.info('[socketio] connection attempt from origin: %s (allowed: %j)', origin, corsOrigin);

    if (corsOrigin.includes(o)) {
      return callback(null, true);
    }

    logger.warn('[socketio] BLOCKED origin: %s', origin);
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
