import { BadRequest, GeneralError } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';
import type { Application } from '../../declarations';

export interface WhatsAppInstanceSettings {
  instanceName: string;
  instanceId: string;
  connected: boolean;
  connectedPhone?: string;
  connectedAt?: string;
}

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

interface CreateInstanceResult {
  action: 'create-instance';
  qrcode?: string;
  instanceName: string;
}

interface GetQrCodeResult {
  action: 'get-qrcode';
  qrcode?: string;
  code?: string;
}

interface CheckStatusResult {
  action: 'check-status';
  connected: boolean;
  phone?: string;
}

interface DisconnectResult {
  action: 'disconnect';
  ok: boolean;
}

type WhatsAppInstanceResult = CreateInstanceResult | GetQrCodeResult | CheckStatusResult | DisconnectResult;

export class WhatsAppInstances {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private getEvolutionConfig(): EvolutionConfig {
    const config = (this.app.get as any)('evolution') || {};
    const apiUrl = config.apiUrl || process.env.EVOLUTION_API_URL || '';
    const apiKey = config.apiKey || process.env.EVOLUTION_API_KEY || '';
    return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey };
  }

  private async getOrganization(params: Params) {
    const organizationId = params.organizationId as string;
    if (!organizationId) {
      throw new BadRequest('Organization context is required');
    }
    return this.app.service('organizations').get(organizationId);
  }

  async create(data: { action: string }, params?: Params): Promise<WhatsAppInstanceResult> {
    const { action } = data;

    switch (action) {
    case 'create-instance':
      return this.createInstance(params!);
    case 'get-qrcode':
      return this.getQrCode(params!);
    case 'check-status':
      return this.checkStatus(params!);
    case 'disconnect':
      return this.disconnect(params!);
    default:
      throw new BadRequest(`Unknown action: ${action}`);
    }
  }

  private async createInstance(params: Params): Promise<CreateInstanceResult> {
    const { apiUrl, apiKey } = this.getEvolutionConfig();
    const org = await this.getOrganization(params) as any;
    const existingSettings = org.settings?.whatsapp as WhatsAppInstanceSettings | undefined;

    if (existingSettings?.instanceName) {
      // Instance already exists, return fresh QR code
      const qrResult = await this.getQrCode(params);
      return {
        action: 'create-instance',
        qrcode: qrResult.qrcode || qrResult.code,
        instanceName: existingSettings.instanceName,
      };
    }

    const instanceName = `athelas-org-${org.id}`;

    const response = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[WhatsApp Instances] Failed to create instance:', errorBody);
      throw new GeneralError('Failed to create WhatsApp instance');
    }

    const result = await response.json() as any;

    // Update org settings with instance data
    const settings = { ...(org.settings || {}) };
    settings.whatsapp = {
      instanceName,
      instanceId: result.instance?.instanceId || result.instance?.id || instanceName,
      connected: false,
    } satisfies WhatsAppInstanceSettings;

    await this.app.service('organizations').patch(org.id, { settings });

    return {
      action: 'create-instance',
      qrcode: result.qrcode?.base64 || result.qrcode?.code,
      instanceName,
    };
  }

  private async getQrCode(params: Params): Promise<GetQrCodeResult> {
    const { apiUrl, apiKey } = this.getEvolutionConfig();
    const org = await this.getOrganization(params) as any;
    const waSettings = org.settings?.whatsapp as WhatsAppInstanceSettings | undefined;

    if (!waSettings?.instanceName) {
      throw new BadRequest('No WhatsApp instance found for this organization');
    }

    const response = await fetch(`${apiUrl}/instance/connect/${waSettings.instanceName}`, {
      method: 'GET',
      headers: { apikey: apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[WhatsApp Instances] Failed to get QR code:', errorBody);
      throw new GeneralError('Failed to get QR code');
    }

    const result = await response.json() as any;

    return {
      action: 'get-qrcode',
      qrcode: result.base64 || result.qrcode?.base64,
      code: result.code || result.qrcode?.code,
    };
  }

  private async checkStatus(params: Params): Promise<CheckStatusResult> {
    const { apiUrl, apiKey } = this.getEvolutionConfig();
    const org = await this.getOrganization(params) as any;
    const waSettings = org.settings?.whatsapp as WhatsAppInstanceSettings | undefined;

    if (!waSettings?.instanceName) {
      return { action: 'check-status', connected: false };
    }

    const response = await fetch(`${apiUrl}/instance/connectionState/${waSettings.instanceName}`, {
      method: 'GET',
      headers: { apikey: apiKey },
    });

    if (!response.ok) {
      return { action: 'check-status', connected: false };
    }

    const result = await response.json() as any;
    const isConnected = result.instance?.state === 'open' || result.state === 'open';

    // Sync cached state with actual connection state
    if (isConnected !== waSettings.connected) {
      const settings = { ...(org.settings || {}) };
      settings.whatsapp = {
        ...waSettings,
        connected: isConnected,
        ...(isConnected ? { connectedAt: waSettings.connectedAt || new Date().toISOString() } : {}),
      };
      await this.app.service('organizations').patch(org.id, { settings });
    }

    return {
      action: 'check-status',
      connected: isConnected,
    };
  }

  private async disconnect(params: Params): Promise<DisconnectResult> {
    const { apiUrl, apiKey } = this.getEvolutionConfig();
    const org = await this.getOrganization(params) as any;
    const waSettings = org.settings?.whatsapp as WhatsAppInstanceSettings | undefined;

    if (!waSettings?.instanceName) {
      return { action: 'disconnect', ok: true };
    }

    try {
      // Logout the instance
      await fetch(`${apiUrl}/instance/logout/${waSettings.instanceName}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      });

      // Delete the instance
      await fetch(`${apiUrl}/instance/delete/${waSettings.instanceName}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      });
    } catch (err) {
      console.error('[WhatsApp Instances] Error during disconnect:', err);
    }

    // Clear whatsapp from org settings
    const settings = { ...(org.settings || {}) };
    delete settings.whatsapp;
    await this.app.service('organizations').patch(org.id, { settings });

    return { action: 'disconnect', ok: true };
  }
}
