import { Router, Request, Response } from 'express';
import { createSearchBundle, createOperationOutcome } from '../utils/fhir-helpers';

export function createConsentRoutes(): Router {
  const router = Router();

  // GET /Consent?patient=:patientId
  // Stub: returns empty search bundle (no consent denial records)
  router.get('/Consent', (req: Request, res: Response) => {
    const patientId = req.query.patient as string | undefined;
    if (!patientId) {
      res.status(400).json(
        createOperationOutcome('error', 'required', 'Search parameter "patient" is required')
      );
      return;
    }

    // No consent denials — patient data may be shared
    res.json(createSearchBundle([], 0));
  });

  return router;
}
