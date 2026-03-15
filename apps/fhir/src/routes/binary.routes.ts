import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { parseEncounterData } from '../utils/encounter-parser';
import { createOperationOutcome } from '../utils/fhir-helpers';
import { summaryLimiter } from '../middleware/rate-limit';
import type { Binary } from '@medplum/fhirtypes';

export function createBinaryRoutes(models: Models): Router {
  const router = Router();

  // GET /Binary/:id - Retrieve encounter content as FHIR Binary
  router.get('/Binary/:id', summaryLimiter, async (req: Request, res: Response) => {
    try {
      const encounterId = req.params.id;

      const encounter = await models.encounters.findByPk(encounterId, {
        attributes: (models.encounters.decryptedAttributes as string[]) || undefined,
        raw: true,
      });

      if (!encounter) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `Binary/${encounterId} not found`)
        );
        return;
      }

      const plain = encounter as unknown as Record<string, unknown>;
      const parsed = parseEncounterData(plain.data);

      // Build a clinical summary object from the parsed encounter data
      const clinicalContent = {
        encounterId,
        date: (plain.date as Date)?.toISOString?.() || null,
        patientId: plain.patientId,
        medicId: plain.medicId,
        conditions: parsed.conditions,
        drugAllergies: parsed.drugAllergies,
        generalAllergies: parsed.generalAllergies,
        medications: parsed.medications,
      };

      const contentString = JSON.stringify(clinicalContent);
      const base64Content = Buffer.from(contentString).toString('base64');

      const binary: Binary = {
        resourceType: 'Binary',
        id: encounterId,
        contentType: 'application/fhir+json',
        data: base64Content,
      };

      res.json(binary);
    } catch (error) {
      console.error('Error fetching binary:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
