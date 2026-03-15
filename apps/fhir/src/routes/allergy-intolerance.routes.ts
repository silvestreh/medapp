import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { parseEncounterData } from '../utils/encounter-parser';
import { mapDrugAllergies, mapGeneralAllergies } from '../mappers/allergy-intolerance.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';
import type { AllergyIntolerance } from '@medplum/fhirtypes';

export function createAllergyIntoleranceRoutes(models: Models): Router {
  const router = Router();

  // GET /AllergyIntolerance?patient=:patientId
  router.get('/AllergyIntolerance', async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patient as string | undefined;
      if (!patientId) {
        res.status(400).json(
          createOperationOutcome('error', 'required', 'Search parameter "patient" is required')
        );
        return;
      }

      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);

      const encounters = await models.encounters.findAll({
        where: { patientId },
        attributes: (models.encounters.decryptedAttributes as string[]) || undefined,
        order: [['date', 'DESC']],
        raw: true,
      });

      const allAllergies: AllergyIntolerance[] = [];

      for (const enc of encounters) {
        const plain = enc as unknown as Record<string, unknown>;
        const parsed = parseEncounterData(plain.data);
        const context = {
          encounterId: plain.id as string,
          patientId: plain.patientId as string,
          medicId: plain.medicId as string,
        };

        if (parsed.drugAllergies.length > 0) {
          allAllergies.push(...mapDrugAllergies(parsed.drugAllergies, context));
        }

        if (Object.keys(parsed.generalAllergies).length > 0) {
          allAllergies.push(...mapGeneralAllergies(parsed.generalAllergies, context));
        }
      }

      const total = allAllergies.length;
      const paginated = allAllergies.slice(offset, offset + count);
      res.json(createSearchBundle(paginated, total));
    } catch (error) {
      console.error('Error searching allergies:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
