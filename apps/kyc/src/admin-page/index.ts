import * as path from 'path';
import { Application } from '../declarations';

export function setupAdminPage(app: Application): void {
  const expressApp = app as any;

  // Serve admin JS bundle with CORS
  expressApp.get('/admin.js', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '../../public/admin.js'));
  });

  // Serve admin CSS (optional)
  expressApp.get('/admin.css', (_req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '../../public/admin-styles.css'));
  });
}
