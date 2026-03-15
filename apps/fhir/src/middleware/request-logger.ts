import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    // Structured JSON logging for production log aggregation
    if (res.statusCode >= 500) {
      console.error(JSON.stringify(log));
    } else {
      console.log(JSON.stringify(log));
    }
  });

  next();
}
