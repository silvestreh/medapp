import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createOperationOutcome } from '../utils/fhir-helpers';

export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  // /metadata is public
  if (req.path === '/metadata') {
    next();
    return;
  }

  // Skip auth in local dev (set FHIR_SKIP_AUTH=true in .env)
  if (process.env.FHIR_SKIP_AUTH === 'true') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(
      createOperationOutcome('error', 'login', 'Missing or invalid Authorization header')
    );
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.FHIR_JWT_SECRET;

  if (!secret) {
    res.status(500).json(
      createOperationOutcome('error', 'exception', 'FHIR_JWT_SECRET not configured')
    );
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);
    (req as Request & { auth: unknown }).auth = decoded;
    next();
  } catch {
    res.status(401).json(
      createOperationOutcome('error', 'login', 'Invalid or expired token')
    );
  }
}
