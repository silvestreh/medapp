import type { Application } from '../../declarations';
import { getClientIp, getClientInfo } from '../../hooks/log-access';

export class Logout {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(_data: Record<string, unknown>, params: any): Promise<{ success: boolean }> {
    const userId = params.user?.id;
    if (!userId) return { success: false };

    const ip = getClientIp({ params } as any);
    const clientInfo = getClientInfo({ params } as any);

    await this.app.service('access-logs').create({
      userId: String(userId),
      organizationId: null,
      resource: 'authentication',
      patientId: null,
      action: 'logout',
      purpose: 'operations',
      ip,
      metadata: clientInfo,
    }).catch(() => {});

    return { success: true };
  }
}
