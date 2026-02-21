import cron from 'node-cron';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';

export function scheduleAppointmentCleanup(app: Application) {
  cron.schedule('0 0 1 * *', async () => {
    try {
      const cutoff = dayjs().subtract(3, 'month').toDate();
      const model = app.service('appointments').Model;

      const deleted = await model.destroy({
        where: { startDate: { [Op.lt]: cutoff } },
      });

      logger.info(
        `Appointment cleanup: deleted ${deleted} appointments older than ${cutoff.toISOString()}`
      );
    } catch (error) {
      logger.error('Appointment cleanup failed:', error);
    }
  });

  logger.info(
    'Scheduled monthly appointment cleanup (1st of each month at midnight)'
  );
}
