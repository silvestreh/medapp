import geoip from 'geoip-lite';
import { Application } from '../declarations';
import logger from '../logger';
import { generateMobileHtml, errorPage } from './template';

export function setupMobilePage(app: Application): void {
  const expressApp = app as any;

  expressApp.get('/verify/:token', async (req: any, res: any) => {
    try {
      await app.get('sequelizeSync');

      const { token } = req.params;
      const sequelize = app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token },
        raw: true,
      });

      if (!session) {
        return res
          .status(404)
          .send(errorPage('Sesión no encontrada', 'El enlace no es válido o ya fue utilizado.'));
      }

      if (new Date(session.expiresAt) < new Date()) {
        return res
          .status(410)
          .send(errorPage('Sesión expirada', 'El enlace ha expirado. Generá uno nuevo desde tu computadora.'));
      }

      if (session.status === 'completed') {
        return res.send(
          errorPage('Verificación completada', 'Ya podés volver a tu computadora.')
        );
      }

      const protocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
      const host = req.get('host');
      const apiBaseUrl = `${protocol}://${host}`;
      logger.info(
        '[mobile-page] Serving page with API base: %s (x-fwd-proto: %s, req.protocol: %s)',
        apiBaseUrl,
        req.get('x-forwarded-proto'),
        req.protocol
      );

      const html = generateMobileHtml(token, apiBaseUrl);
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      logger.error('[mobile-page] Error:', error.message);
      res.status(500).send('Internal server error');
    }
  });

  expressApp.patch('/verification-sessions/by-token', async (req: any, res: any) => {
    try {
      const sessionToken = req.headers['x-session-token'];
      if (!sessionToken) {
        return res.status(401).json({ message: 'Missing session token' });
      }

      await app.get('sequelizeSync');

      const sequelize = app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
      });

      if (!session) {
        return res.status(403).json({ message: 'Invalid session token' });
      }

      if (new Date((session as any).expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Session has expired' });
      }

      const allowed = ['idFrontUrl', 'idBackUrl', 'selfieUrl', 'status', 'documentType'];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in req.body) {
          updates[key] = req.body[key];
        }
      }

      // Capture forensic data on first PATCH (when session has no clientIp yet)
      if (!(session as any).clientIp) {
        updates.clientIp = req.ip || req.headers['x-forwarded-for'] || null;
        updates.clientUserAgent = req.headers['user-agent'] || null;
      }

      // Accept device fingerprint from client
      if (req.body.deviceFingerprint) {
        const fingerprint = req.body.deviceFingerprint as Record<string, unknown>;
        updates.deviceFingerprint = fingerprint;

        // IP-based geolocation fallback when user denied precise GPS
        if (!fingerprint.geolocation) {
          const clientIp = updates.clientIp || (session as any).clientIp;
          if (clientIp) {
            const geo = geoip.lookup(String(clientIp));
            if (geo) {
              fingerprint.geolocation = {
                latitude: geo.ll[0],
                longitude: geo.ll[1],
                accuracy: null,
                source: 'ip',
                city: geo.city,
                region: geo.region,
                country: geo.country,
              };
            }
          }
        }
      }

      await session.update(updates);

      const updated = await app.service('verification-sessions').patch(
        (session as any).id,
        updates,
        { provider: undefined } as any
      );

      // Auto-create identity verification when session completes with required photos
      if (updates.status === 'completed') {
        const s = updated as any;
        const isPassport = s.documentType === 'passport';
        const hasRequiredPhotos = isPassport
          ? s.idFrontUrl && s.selfieUrl
          : s.idFrontUrl && s.idBackUrl && s.selfieUrl;

        if (hasRequiredPhotos) {
          try {
            await app.service('identity-verifications').create({
              userId: s.userId,
              sessionId: s.id,
              idFrontUrl: s.idFrontUrl,
              idBackUrl: isPassport ? null : s.idBackUrl,
              selfieUrl: s.selfieUrl,
              status: 'pending',
              clientIp: s.clientIp || null,
              clientUserAgent: s.clientUserAgent || null,
              deviceFingerprint: s.deviceFingerprint || null,
              idData: s.idData || null,
              documentType: s.documentType || null,
            }, { provider: undefined } as any);
            logger.info('[mobile-page] Auto-created identity verification for session %s (documentType: %s, idData: %j)', s.id, s.documentType, s.idData);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[mobile-page] Failed to create identity verification: %s', message);
          }
        }
      }

      res.json(updated);
    } catch (error: any) {
      logger.error('[mobile-page] PATCH error:', error.message);
      res.status(500).json({ message: error.message || 'Update failed' });
    }
  });
}
