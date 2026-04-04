import { Hook, HookContext } from '@feathersjs/feathers';
import { sanitizeForLog } from '../utils/sanitize-for-log';

/**
 * Logs service calls for debugging. Only active when DEBUG=true.
 * Usage: debug('before') or debug('after')
 */
export const debug = (phase: 'before' | 'after'): Hook => {
  return (context: HookContext): HookContext => {
    if (process.env.DEBUG !== 'true') return context;

    const { method, path } = context;
    const label = phase.toUpperCase();

    console.log(`[${label}] ${path}:${method}`);

    if (phase === 'before') {
      if (context.params.query) {
        console.log('query =', JSON.stringify(sanitizeForLog(context.params.query), null, 2));
      }
      if (context.data) {
        console.log('data =', JSON.stringify(sanitizeForLog(context.data), null, 2));
      }
    }

    if (phase === 'after') {
      if (context.result) {
        console.log('result =', JSON.stringify(sanitizeForLog(context.result), null, 2));
      }
    }

    return context;
  };
};
