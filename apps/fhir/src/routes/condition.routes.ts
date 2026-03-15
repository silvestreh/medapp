import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { parseEncounterData } from '../utils/encounter-parser';
import { mapConditions } from '../mappers/condition.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';
import type { Condition } from '@medplum/fhirtypes';

export function createConditionRoutes(models: Models): Router {
  const router = Router();

  // GET /Condition?patient=:patientId
  router.get('/Condition', async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patient as string | undefined;
      if (!patientId) {
        res.status(400).json(
          createOperationOutcome('error', 'required', 'Search parameter "patient" is required')
        );
        return;
      }

      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);

      const encounterWhere: Record<string, unknown> = { patientId };
      const encounters = await models.encounters.findAll({
        where: encounterWhere,
        attributes: (models.encounters.decryptedAttributes as string[]) || undefined,
        order: [['date', 'DESC']],
        raw: true,
      });

      // Build ICD-10 lookup for display names
      const allConditions: Condition[] = [];
      const icdCodes = new Set<string>();

      // First pass: collect ICD codes
      for (const enc of encounters) {
        const plain = enc as unknown as Record<string, unknown>;
        const parsed = parseEncounterData(plain.data);
        for (const c of parsed.conditions) {
          icdCodes.add(c.issueId);
        }
      }

      // Lookup ICD-10 display names
      const icdLookup: Record<string, string> = {};
      if (icdCodes.size > 0) {
        const icdRecords = await models.icd_10.findAll({
          where: { id: Array.from(icdCodes) },
          raw: true,
        });
        for (const rec of icdRecords) {
          const plain = rec as unknown as { id: string; name: string };
          icdLookup[plain.id] = plain.name;
        }
      }

      // Second pass: map conditions
      for (const enc of encounters) {
        const plain = enc as unknown as Record<string, unknown>;
        const parsed = parseEncounterData(plain.data);
        if (parsed.conditions.length > 0) {
          const mapped = mapConditions(parsed.conditions, {
            encounterId: plain.id as string,
            patientId: plain.patientId as string,
            medicId: plain.medicId as string,
            encounterDate: (plain.date as Date)?.toISOString?.() || '',
          }, icdLookup);
          allConditions.push(...mapped);
        }
      }

      const total = allConditions.length;
      const paginated = allConditions.slice(offset, offset + count);
      res.json(createSearchBundle(paginated, total));
    } catch (error) {
      console.error('Error searching conditions:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
