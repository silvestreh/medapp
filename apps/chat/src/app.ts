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

const app: Application = express(feathers());

app.configure(configuration());

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3030','http://localhost:5173'];

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/healthz', (_req: any, res: any) => {
  res.json({ ok: true });
});

app.configure(express.rest());
app.configure(socketio((io) => {
  io.origins((origin, callback) => {
    const o = origin?.trim()?.toLowerCase();

    console.log('origin', o);
    console.log('corsOrigin', corsOrigin);

    if (corsOrigin.includes(o)) {
      return callback(null, true);
    }

    // Fail for everything else
    console.warn(`[Chat] Blocked connection attempt from unauthorized origin: ${origin}`);
    return callback('origin not allowed', false);
  });
  // if (corsOrigin === '*') {
  //   io.origins('*:*');
  // } else {
  //   const allowed = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
  //   io.origins((origin: string, cb: (err: string | null, ok: boolean) => void) => {
  //     cb(null, allowed.some(a => origin.startsWith(a)));
  //   });
  // }

  // Typing indicator relay — ephemeral, no persistence
  io.on('connection', (socket: any) => {
    socket.on('typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (!data.conversationId || !data.userId) return;
      socket.broadcast.emit('typing', data);
    });
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
