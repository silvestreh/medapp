import logger from './logger';
import Sentry from './sentry';
import app from './app';
import { scheduleAppointmentCleanup } from './cron/cleanup-appointments';
import { scheduleLicenseRevalidation } from './cron/license-revalidation';

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
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
