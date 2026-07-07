import { Queue, Worker, UnrecoverableError, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { Application } from '../declarations';
import logger from '../logger';
import Sentry from '../sentry';
import type { WhatsAppCreateData } from '../services/whatsapp/whatsapp.class';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-send';

const MAX_AGE_MS = 60 * 60 * 1000;

let queue: Queue<WhatsAppCreateData> | null = null;
let worker: Worker<WhatsAppCreateData> | null = null;
let connection: IORedis | null = null;

function buildConnection(): IORedis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function getWhatsappQueue(): Queue<WhatsAppCreateData> | null {
  if (queue) return queue;
  if (!connection) connection = buildConnection();
  if (!connection) return null;
  queue = new Queue<WhatsAppCreateData>(WHATSAPP_QUEUE_NAME, {
    connection: connection as ConnectionOptions,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: false,
    },
  });
  return queue;
}

let enqueueImpl: (payload: WhatsAppCreateData) => Promise<boolean> = async (payload) => {
  const q = getWhatsappQueue();
  if (!q) return false;
  try {
    await q.add('send', payload);
    return true;
  } catch (err) {
    logger.error('[WhatsApp Queue] Failed to enqueue:', err);
    Sentry.captureException(err, { tags: { feature: 'whatsapp', step: 'enqueue' } });
    return false;
  }
};

export function enqueueWhatsapp(payload: WhatsAppCreateData): Promise<boolean> {
  return enqueueImpl(payload);
}

export function setEnqueueImplForTesting(fn: (payload: WhatsAppCreateData) => Promise<boolean>): void {
  enqueueImpl = fn;
}

export function startWhatsappWorker(app: Application): Worker<WhatsAppCreateData> | null {
  if (worker) return worker;
  if (!connection) connection = buildConnection();
  if (!connection) {
    logger.warn('[WhatsApp Queue] REDIS_URL not set — queue/worker disabled');
    return null;
  }

  worker = new Worker<WhatsAppCreateData>(
    WHATSAPP_QUEUE_NAME,
    async (job) => {
      if (Date.now() - job.timestamp > MAX_AGE_MS) {
        throw new UnrecoverableError(`Job older than ${MAX_AGE_MS / 1000}s — dropping`);
      }
      const service = app.service('whatsapp') as any;
      try {
        const result = await service._sendNow(job.data);
        if (!result?.sent) {
          throw new Error(`WhatsApp send returned sent=false: ${result?.reason || 'unknown'}`);
        }
        return result;
      } catch (err: any) {
        if (err?.__whatsappRetryable === true) {
          throw err;
        }
        throw new UnrecoverableError(err?.message || 'WhatsApp send failed (non-retryable)');
      }
    },
    {
      connection: connection as ConnectionOptions,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    const attempts = job?.attemptsMade ?? 0;
    const max = job?.opts?.attempts ?? 0;
    logger.warn(`[WhatsApp Queue] Job ${job?.id} failed (attempt ${attempts}/${max}): ${err.message}`);
    if (attempts >= max || err instanceof UnrecoverableError) {
      Sentry.captureException(err, {
        tags: { feature: 'whatsapp', step: 'queue-terminal' },
        extra: { jobId: job?.id, attempts, max, data: job?.data },
      });
    }
  });

  worker.on('error', (err) => {
    logger.error('[WhatsApp Queue] Worker error:', err.message);
  });

  logger.info('[WhatsApp Queue] Worker started');
  return worker;
}

export async function shutdownWhatsappQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}

export function resetWhatsappQueueForTesting(): void {
  worker = null;
  queue = null;
  connection = null;
  enqueueImpl = async (payload) => {
    const q = getWhatsappQueue();
    if (!q) return false;
    try {
      await q.add('send', payload);
      return true;
    } catch (err) {
      logger.error('[WhatsApp Queue] Failed to enqueue:', err);
      Sentry.captureException(err, { tags: { feature: 'whatsapp', step: 'enqueue' } });
      return false;
    }
  };
}
