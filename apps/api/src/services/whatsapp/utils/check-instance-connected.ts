import type { Application } from '../../../declarations';
import type { WhatsAppInstanceSettings } from '../../whatsapp-instances/whatsapp-instances.class';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

export function getEvolutionConfig(app: Application): EvolutionConfig {
  const config = (app.get as any)('evolution') || {};
  const apiUrl = (config.apiUrl || process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const apiKey = config.apiKey || process.env.EVOLUTION_API_KEY || '';
  return { apiUrl, apiKey };
}

export interface InstanceConnectionResult {
  ok: boolean;
  connected: boolean;
  instanceName: string | null;
  reason?: 'no-instance' | 'evolution-unreachable' | 'evolution-not-configured';
}

export async function checkInstanceConnected(
  app: Application,
  organizationId: string
): Promise<InstanceConnectionResult> {
  const { apiUrl, apiKey } = getEvolutionConfig(app);
  if (!apiUrl || !apiKey) {
    return { ok: false, connected: false, instanceName: null, reason: 'evolution-not-configured' };
  }

  let org: any;
  try {
    org = await app.service('organizations').get(organizationId);
  } catch {
    return { ok: false, connected: false, instanceName: null, reason: 'no-instance' };
  }

  const waSettings = org?.settings?.whatsapp as WhatsAppInstanceSettings | undefined;
  if (!waSettings?.instanceName) {
    return { ok: false, connected: false, instanceName: null, reason: 'no-instance' };
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/instance/connectionState/${waSettings.instanceName}`, {
      method: 'GET',
      headers: { apikey: apiKey },
    });
  } catch {
    return { ok: false, connected: false, instanceName: waSettings.instanceName, reason: 'evolution-unreachable' };
  }

  if (!response.ok) {
    return { ok: false, connected: false, instanceName: waSettings.instanceName, reason: 'evolution-unreachable' };
  }

  const body = await response.json() as any;
  const connected = body?.instance?.state === 'open' || body?.state === 'open';

  if (connected !== Boolean(waSettings.connected)) {
    try {
      const settings = { ...(org.settings || {}) };
      settings.whatsapp = {
        ...waSettings,
        connected,
        ...(connected ? { connectedAt: waSettings.connectedAt || new Date().toISOString() } : {}),
      };
      await app.service('organizations').patch(organizationId, { settings });
    } catch {
      // Non-fatal — caller still gets accurate connected value
    }
  }

  return { ok: true, connected, instanceName: waSettings.instanceName };
}
