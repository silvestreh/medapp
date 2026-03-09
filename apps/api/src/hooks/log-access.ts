import { Hook, HookContext } from '@feathersjs/feathers';
import { UAParser } from 'ua-parser-js';

type ResourceType = 'encounters' | 'studies' | 'prescriptions';
type AccessAction = 'read' | 'write' | 'export';

interface LogAccessOptions {
  resource: ResourceType;
  action?: AccessAction;
  /** Extract patientId from the context. Defaults to context.data.patientId or result.patientId */
  getPatientId?: (context: HookContext) => string | undefined;
  /** Extract extra metadata to store alongside the log entry */
  getMetadata?: (context: HookContext) => Record<string, any> | undefined;
}

function resolveAction(context: HookContext, override?: AccessAction): AccessAction {
  if (override) return override;
  const { method } = context;
  if (method === 'find' || method === 'get') return 'read';
  return 'write';
}

function getClientIp(context: HookContext): string | null {
  const headers = context.params?.headers;
  if (headers) {
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    }
  }
  // Express req.ip (respects trust proxy setting)
  const req = (context.params as any)?.req;
  if (req?.ip) return req.ip;

  const connection = (context.params as any)?.connection;
  if (connection?.remoteAddress) return connection.remoteAddress;
  return null;
}

function getClientInfo(context: HookContext): Record<string, any> | null {
  const ua = context.params?.headers?.['user-agent'];
  if (!ua) return null;

  const { browser, os, device } = UAParser(ua);

  const info: Record<string, any> = {};
  if (browser.name) info.browser = browser.name + (browser.version ? ` ${browser.version}` : '');
  if (os.name) info.os = os.name + (os.version ? ` ${os.version}` : '');
  if (device.type) info.deviceType = device.type;
  if (device.vendor) info.deviceVendor = device.vendor;
  if (device.model) info.deviceModel = device.model;
  info.userAgent = ua;

  return info;
}

function getPatientIdFromContext(context: HookContext): string | undefined {
  // For find, try query params
  if (context.method === 'find') {
    return context.params?.query?.patientId;
  }
  // For get/patch/remove, try the result
  const result = context.result;
  if (result) {
    // Single result
    if (result.patientId) return result.patientId;
    // Paginated result — don't log individual items for find, just the query target
    if (result.data?.[0]?.patientId) return result.data[0].patientId;
  }
  // For create, try data
  if (context.data?.patientId) return context.data.patientId;
  return undefined;
}

export const logAccess = (options: LogAccessOptions): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const userId = context.params?.user?.id;
    // Only log for external (authenticated) requests
    if (!userId || context.params?.provider === undefined) return context;

    const patientId = options.getPatientId
      ? options.getPatientId(context)
      : getPatientIdFromContext(context);

    if (!patientId) return context;

    const action = resolveAction(context, options.action);
    const ip = getClientIp(context);
    const customMetadata = options.getMetadata ? options.getMetadata(context) : undefined;
    const clientInfo = getClientInfo(context);

    const metadata = (customMetadata || clientInfo)
      ? { ...clientInfo, ...customMetadata }
      : undefined;

    // Fire and forget — access logging should never break the main request
    context.app.service('access-logs').create({
      userId: String(userId),
      organizationId: context.params.organizationId || null,
      resource: options.resource,
      patientId: String(patientId),
      action,
      ip,
      ...(metadata ? { metadata } : {}),
    }).catch(() => { /* best-effort */ });

    return context;
  };
};
