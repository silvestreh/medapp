import * as path from 'path';
import crypto from 'crypto';
import { Application } from '../declarations';
import logger from '../logger';

const SESSION_TTL_MINUTES = 15;

export function setupWidgetPage(app: Application): void {
  const expressApp = app as any;

  // Serve widget JS bundle with CORS + CORP headers
  expressApp.get('/widget.js', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, '../../public/widget.js'));
  });

  // Serve widget CSS (optional, can be inlined)
  expressApp.get('/widget.css', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, '../../public/widget-styles.css'));
  });

  // CORS preflight for widget endpoints
  expressApp.options('/widget/sessions', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-publishable-key, Authorization');
    res.set('Access-Control-Max-Age', '86400');
    res.status(204).end();
  });

  // Create verification session (SDK endpoint)
  expressApp.post('/widget/sessions', async (req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
      await app.get('sequelizeSync');

      const publishableKey = req.headers['x-publishable-key'];
      const authHeader = req.headers['authorization'];
      const expectedPublishable = process.env.WIDGET_PUBLISHABLE_KEY;

      let userId: string | undefined;

      if (publishableKey && expectedPublishable && publishableKey === expectedPublishable) {
        // Publishable key auth — userId must be in body
        userId = req.body?.userId;
        if (!userId) {
          return res.status(400).json({ message: 'userId is required' });
        }
      } else if (authHeader?.startsWith('Bearer ')) {
        // JWT auth — authenticate and extract userId
        try {
          const token = authHeader.slice(7);
          const authResult = await app.service('authentication').create({
            strategy: 'jwt',
            accessToken: token,
          }, { provider: undefined } as any);
          userId = authResult.user?.id;
        } catch {
          return res.status(401).json({ message: 'Invalid token' });
        }
      } else {
        return res.status(401).json({ message: 'Authentication required (x-publishable-key or Authorization header)' });
      }

      if (!userId) {
        return res.status(400).json({ message: 'Could not determine userId' });
      }

      const session = await app.service('verification-sessions').create({
        userId,
        token: crypto.randomBytes(32).toString('hex'),
        status: 'waiting',
        expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000),
        idData: req.body?.idData || null,
        callbackUrl: req.body?.callbackUrl || null,
        callbackSecret: req.body?.callbackSecret || null,
      }, { provider: undefined } as any);

      res.json({
        token: (session as any).token,
        expiresAt: (session as any).expiresAt,
      });
    } catch (error: any) {
      logger.error('[widget] create session error:', error.message);
      res.status(500).json({ message: error.message || 'Session creation failed' });
    }
  });

  // Session status endpoint for QR fallback polling
  expressApp.get('/widget/session-status', async (req: any, res: any) => {
    try {
      const sessionToken = req.headers['x-session-token'];
      if (!sessionToken) {
        return res.status(401).json({ message: 'Missing session token' });
      }

      await app.get('sequelizeSync');

      const sequelize = app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
        attributes: ['status', 'idFrontUrl', 'idBackUrl', 'selfieUrl'],
        raw: true,
      });

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      res.json({
        status: session.status,
        idFrontUrl: session.idFrontUrl || null,
        idBackUrl: session.idBackUrl || null,
        selfieUrl: session.selfieUrl || null,
      });
    } catch (error: any) {
      logger.error('[widget] session-status error:', error.message);
      res.status(500).json({ message: 'Internal error' });
    }
  });
}
