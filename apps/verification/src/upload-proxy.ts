import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { AuthenticationService } from '@feathersjs/authentication';
import { Application } from './declarations';
import logger from './logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function setupUploadProxy(app: Application): void {
  const expressApp = app as any;

  expressApp.post('/upload', upload.single('file'), async (req: any, res: any) => {
    try {
      const sessionToken = req.headers['x-session-token'];
      if (!sessionToken) {
        return res.status(401).json({ message: 'Missing session token' });
      }

      // Wait for DB sync before querying
      await app.get('sequelizeSync');

      const sequelize = app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
        raw: true,
      });

      if (!session) {
        return res.status(403).json({ message: 'Invalid session token' });
      }

      if (new Date(session.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Session has expired' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      // Generate a JWT for the session's userId using the shared auth secret
      const authService = app.service('authentication') as unknown as AuthenticationService;
      const accessToken = await authService.createAccessToken({ sub: session.userId });

      // Forward the file to the main API's file-uploads endpoint
      const mainApiUrl = app.get('mainApiUrl') || 'http://localhost:3030';
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const response = await axios.post(
        `${mainApiUrl}/file-uploads?encrypted=true`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${accessToken}`,
          },
          maxContentLength: 10 * 1024 * 1024,
        }
      );

      return res.json({ url: response.data.url });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const responseData = error.response?.data;
      const message = responseData?.message || error.message || 'Upload failed';
      logger.error('[upload-proxy] Error: %s | Status: %d | Upstream: %j | Code: %s',
        error.message, status, responseData, error.code);
      return res.status(status).json({ message });
    }
  });
}
