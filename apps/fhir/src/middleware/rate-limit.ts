import rateLimit from 'express-rate-limit';
import { createOperationOutcome } from '../utils/fhir-helpers';

// General rate limiter: 100 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(
      createOperationOutcome('error', 'throttled', 'Too many requests — try again later')
    );
  },
});

// Stricter limiter for $summary (expensive operation): 10 per minute per IP
export const summaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(
      createOperationOutcome('error', 'throttled', 'Too many $summary requests — try again later')
    );
  },
});
