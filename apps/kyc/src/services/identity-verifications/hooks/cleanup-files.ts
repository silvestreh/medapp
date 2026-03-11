import { Hook, HookContext } from '@feathersjs/feathers';
import { deleteFromDisk } from '../../../file-storage';
import logger from '../../../logger';

/**
 * After.patch hook that deletes encrypted files when verification reaches a terminal status.
 */
export const cleanupFiles = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const verification = context.result;
    if (!verification) return context;

    const { status } = verification;
    if (status !== 'verified' && status !== 'rejected') return context;

    const uploadsDir = context.app.get('uploads')?.dir || './uploads';
    const urls = [verification.idFrontUrl, verification.idBackUrl, verification.selfieUrl].filter(Boolean);

    for (const url of urls) {
      try {
        deleteFromDisk(uploadsDir, url);
        logger.info('[cleanup] Deleted: %s', url);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('[cleanup] Failed to delete %s: %s', url, message);
      }
    }

    return context;
  };
};
