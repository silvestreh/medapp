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

  // Check latest verification status by userId (no session needed)
  expressApp.options('/widget/user-verification-status', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-publishable-key, Authorization');
    res.status(204).end();
  });

  expressApp.get('/widget/user-verification-status', async (req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
      const publishableKey = req.headers['x-publishable-key'];
      const authHeader = req.headers['authorization'];
      const expectedPublishable = process.env.WIDGET_PUBLISHABLE_KEY;

      const isAuthed = (publishableKey && expectedPublishable && publishableKey === expectedPublishable)
        || (authHeader?.startsWith('Bearer '));
      if (!isAuthed) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const userId = req.query.userId;
      if (!userId) {
        return res.status(400).json({ message: 'userId query param is required' });
      }

      await app.get('sequelizeSync');
      const sequelize = app.get('sequelizeClient');

      const verification = await sequelize.models.identity_verifications.findOne({
        where: { userId },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'status', 'idData'],
        raw: true,
      });

      if (!verification) {
        return res.json({ status: null, idData: null });
      }

      res.json({ status: verification.status, idData: verification.idData });
    } catch (error: any) {
      logger.error('[widget] user-verification-status error:', error.message);
      res.status(500).json({ message: 'Internal error' });
    }
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
        documentType: req.body?.documentType || null,
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

  // Verification status endpoint (for widget polling after submission)
  expressApp.get('/widget/verification-status', async (req: any, res: any) => {
    try {
      const sessionToken = req.headers['x-session-token'];
      if (!sessionToken) {
        return res.status(401).json({ message: 'Missing session token' });
      }

      await app.get('sequelizeSync');
      const sequelize = app.get('sequelizeClient');

      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
        attributes: ['id'],
        raw: true,
      });
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Find the latest identity verification for this session
      const verification = await sequelize.models.identity_verifications.findOne({
        where: { sessionId: session.id },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'status', 'autoCheckProgress', 'rejectionReason', 'faceMatch', 'faceMatchConfidence'],
        raw: true,
      });

      if (!verification) {
        return res.json({ status: 'pending', autoCheckProgress: null });
      }

      res.json({
        verificationId: verification.id,
        status: verification.status,
        autoCheckProgress: verification.autoCheckProgress,
        rejectionReason: verification.rejectionReason,
        faceMatch: verification.faceMatch,
        faceMatchConfidence: verification.faceMatchConfidence,
      });
    } catch (error: any) {
      logger.error('[widget] verification-status error:', error.message);
      res.status(500).json({ message: 'Internal error' });
    }
  });

  // Resubmit selfie (for glasses retry flow)
  expressApp.post('/widget/resubmit-selfie/:verificationId', async (req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
      const sessionToken = req.headers['x-session-token'];
      if (!sessionToken) {
        return res.status(401).json({ message: 'Missing session token' });
      }

      const { verificationId } = req.params;
      const { selfieUrl } = req.body;
      if (!selfieUrl) {
        return res.status(400).json({ message: 'selfieUrl is required' });
      }

      await app.get('sequelizeSync');
      const sequelize = app.get('sequelizeClient');

      // Verify session owns this verification
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
        raw: true,
      });
      if (!session) {
        return res.status(403).json({ message: 'Invalid session' });
      }

      const verification = await sequelize.models.identity_verifications.findOne({
        where: { id: verificationId, sessionId: session.id },
        raw: true,
      });
      if (!verification) {
        return res.status(404).json({ message: 'Verification not found' });
      }
      if (verification.status !== 'selfie_retry') {
        return res.status(400).json({ message: 'Verification is not in selfie_retry status' });
      }

      // Update selfie and reset face match fields, re-trigger face comparison
      await app.service('identity-verifications').patch(
        verificationId,
        {
          selfieUrl,
          faceMatch: null,
          faceMatchConfidence: null,
          faceMatchError: null,
          autoCheckProgress: { step: 'submitting_face_compare' },
          autoCheckCompletedAt: null,
          status: 'pending',
          rejectionReason: null,
        },
        { provider: undefined } as any,
      );

      // Re-submit face comparison job
      const faceCompareUrl = process.env.FACE_COMPARE_API_URL;
      const faceCompareApiKey = process.env.FACE_COMPARE_API_KEY;
      const kycBaseUrl = process.env.KYC_BASE_URL;

      if (faceCompareUrl && faceCompareApiKey && kycBaseUrl) {
        const axios = require('axios');
        const payload = {
          id_url: `${kycBaseUrl}${verification.idFrontUrl}`,
          video_url: `${kycBaseUrl}${selfieUrl}`,
          progress_url: `${kycBaseUrl}/auto-check-progress/${verificationId}`,
          verification_id: verificationId,
          callback_key: faceCompareApiKey,
        };

        try {
          await axios.post(`${faceCompareUrl}/compare-async`, payload, { timeout: 10000 });
          logger.info('[widget] Face compare re-submitted for %s', verificationId);
        } catch (err: any) {
          logger.error('[widget] Failed to re-submit face compare: %s', err.message);
        }
      }

      res.json({ ok: true });
    } catch (error: any) {
      logger.error('[widget] resubmit-selfie error:', error.message);
      res.status(500).json({ message: 'Internal error' });
    }
  });

  // CORS preflight for resubmit-selfie
  expressApp.options('/widget/resubmit-selfie/:verificationId', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
    res.status(204).end();
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
