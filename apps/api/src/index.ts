import logger from './logger';
import Sentry from './sentry';
import app from './app';
import { scheduleAppointmentCleanup } from './cron/cleanup-appointments';
import { scheduleLicenseRevalidation } from './cron/license-revalidation';
import { scheduleDoseReminderPush } from './cron/dose-reminder-push';

const port = app.get('port');
const server = app.listen(port);

process.on('unhandledRejection', (reason, p) => {
  logger.error('Unhandled Rejection at: Promise ', p, reason);
  Sentry.captureException(reason);
});

server.on('listening', () => {
  logger.info('Feathers application started on http://%s:%d', app.get('host'), port);
  scheduleAppointmentCleanup(app);
  scheduleLicenseRevalidation(app);
  scheduleDoseReminderPush(app);

  app.service('access-logs').create({
    userId: null,
    organizationId: null,
    resource: 'system',
    patientId: null,
    action: 'execute',
    purpose: 'operations',
    ip: null,
    metadata: { event: 'startup', port, host: app.get('host') },
  }).catch(() => {});
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');

  app.service('access-logs').create({
    userId: null,
    organizationId: null,
    resource: 'system',
    patientId: null,
    action: 'execute',
    purpose: 'operations',
    ip: null,
    metadata: { event: 'shutdown', reason: 'SIGTERM' },
  }).then(() => {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }).catch(() => {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
});
