import { Hook, HookContext } from '@feathersjs/feathers';
import Sentry from '../sentry';

/**
 * Tags every external request in Sentry with `request.source: proxy | direct`.
 * Compares the `x-proxy-token` header against the PROXY_SECRET env var.
 * Skipped entirely when PROXY_SECRET is not configured.
 */
export const tagRequestSource = (): Hook => {
  return (context: HookContext): HookContext => {
    const proxySecret = process.env.PROXY_SECRET;
    if (!proxySecret || !context.params.provider) return context;

    const token = context.params.headers?.['x-proxy-token'];
    Sentry.setTag('request.source', token === proxySecret ? 'proxy' : 'direct');

    return context;
  };
};
