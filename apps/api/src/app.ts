import dotenv from 'dotenv';
dotenv.config();

import Sentry from './sentry';

// import path from 'path';
// import favicon from 'serve-favicon';
// import compress from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import feathers from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import express from '@feathersjs/express';



import { Application } from './declarations';
import logger from './logger';
import middleware from './middleware';
import services from './services';
import appHooks from './app.hooks';
import channels from './channels';
import { HookContext as FeathersHookContext } from '@feathersjs/feathers';
import authentication from './authentication';
import sequelize from './sequelize';
import qs from 'qs';
// Don't remove this comment. It's needed to format import lines nicely.
const app: Application = express(feathers());
export type HookContext<T = any> = { app: Application } & FeathersHookContext<T>;

// qs default arrayLimit is 20; arrays with >20 elements are silently
// converted to objects, breaking Sequelize $in queries.
app.set('query parser', (str: string) => qs.parse(str, { arrayLimit: 500 }));
app.configure(configuration());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', '\'unsafe-inline\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      imgSrc: ['\'self\'', 'data:', 'blob:'],
      connectSrc: ['\'self\''],
      fontSrc: ['\'self\''],
      objectSrc: ['\'none\''],
      frameAncestors: ['\'none\''],
    },
  },
}));
const isProductionEnv = process.env.NODE_ENV === 'production';
if (isProductionEnv && !process.env.CORS_ORIGIN) {
  logger.warn('CORS_ORIGIN is not set in production — falling back to app host. Set CORS_ORIGIN explicitly.');
}
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : isProductionEnv
      ? [`https://${app.get('host')}`]
      : '*',
  credentials: true,
}));
// app.use(compress());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(app.get('public')));
app.configure(express.rest());
app.configure(sequelize);

// Rate-limit login attempts (disabled during tests).
// Only count requests using the 'local' strategy (credential-based logins).
// JWT re-authentication happens on every page load and must not be throttled.
if (process.env.NODE_ENV !== 'test') {
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.body?.strategy !== 'local',
    message: { message: 'Too many login attempts, please try again later' },
  });
  app.use('/authentication', authLimiter);
}

// Configure other middleware (see `middleware/index.ts`)
app.configure(middleware);
app.configure(authentication);
// Set up our services (see `services/index.ts`)
app.configure(services);
// Set up event channels (see channels.ts)
app.configure(channels);

// Configure a middleware for 404s and the error handler
app.use(express.notFound());
Sentry.setupExpressErrorHandler(app);
app.use(express.errorHandler({ logger } as any));

app.hooks(appHooks);

export default app;
