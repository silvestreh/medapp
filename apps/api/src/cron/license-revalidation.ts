import cron from 'node-cron';
import { Op, Sequelize } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';
import { PractitionerVerification } from '../services/practitioner-verification/practitioner-verification.class';

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 10 * 60 * 1000;

async function processRecords(app: Application, records: any[]) {
  const sequelize: Sequelize = app.get('sequelizeClient');
  const mdSettingsModel = sequelize.models.md_settings;
  const verificationService = new PractitionerVerification(app);
  const now = new Date();

  for (const record of records) {
    try {
      await verificationService.verifyByUserId(record.userId);
      logger.info(`License revalidation: verified user ${record.userId}`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: any) {
      const retries = (record.verificationRetries || 0) + 1;

      if (retries >= MAX_RETRIES) {
        await mdSettingsModel.update(
          {
            isVerified: false,
            verificationRetries: 0,
            nextVerificationRetry: null,
          },
          { where: { id: record.id } }
        );
        logger.warn(
          `License revalidation: user ${record.userId} marked unverified after ${MAX_RETRIES} failed retries`
        );
      } else {
        const nextRetry = new Date(now.getTime() + RETRY_INTERVAL_MS);
        await mdSettingsModel.update(
          {
            verificationRetries: retries,
            nextVerificationRetry: nextRetry,
          },
          { where: { id: record.id } }
        );
        logger.info(
          `License revalidation: user ${record.userId} retry ${retries}/${MAX_RETRIES}, next at ${nextRetry.toISOString()}`
        );
      }
    }
  }
}

export function scheduleLicenseRevalidation(app: Application) {
  // Weekly check at midnight on Mondays: detect newly expired licenses
  cron.schedule('0 0 * * 1', async () => {
    try {
      const sequelize: Sequelize = app.get('sequelizeClient');
      const mdSettingsModel = sequelize.models.md_settings;
      const now = new Date();

      const expired = await mdSettingsModel.findAll({
        where: {
          isVerified: true,
          licenseExpirationDate: { [Op.lt]: now },
          verificationRetries: 0,
        },
        raw: true,
      }) as any[];

      if (expired.length === 0) {
        return;
      }

      logger.info(`License revalidation (daily): found ${expired.length} expired license(s)`);
      await processRecords(app, expired);
    } catch (error) {
      logger.error('License revalidation daily check failed:', error);
    }
  });

  // Every 10 minutes: process pending retries only
  cron.schedule('*/10 * * * *', async () => {
    try {
      const sequelize: Sequelize = app.get('sequelizeClient');
      const mdSettingsModel = sequelize.models.md_settings;
      const now = new Date();

      const retryPending = await mdSettingsModel.findAll({
        where: {
          nextVerificationRetry: { [Op.lte]: now },
          verificationRetries: { [Op.gt]: 0, [Op.lt]: MAX_RETRIES },
        },
        raw: true,
      }) as any[];

      if (retryPending.length === 0) {
        return;
      }

      logger.info(`License revalidation (retry): processing ${retryPending.length} pending retry(ies)`);
      await processRecords(app, retryPending);
    } catch (error) {
      logger.error('License revalidation retry check failed:', error);
    }
  });

  logger.info('Scheduled license revalidation (weekly on Mondays at midnight, retries every 10 minutes)');
}
