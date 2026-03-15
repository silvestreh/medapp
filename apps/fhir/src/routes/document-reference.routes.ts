import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';
import { DOMAIN_SYSTEM } from '../utils/identifiers';
import type { DocumentReference } from '@medplum/fhirtypes';

export function createDocumentReferenceRoutes(models: Models): Router {
  const router = Router();

  // GET /DocumentReference?patient=:patientId
  router.get('/DocumentReference', async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patient as string | undefined;
      if (!patientId) {
        res.status(400).json(
          createOperationOutcome('error', 'required', 'Search parameter "patient" is required')
        );
        return;
      }

      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);

      // Each encounter represents a clinical document
      const { rows, count: total } = await models.encounters.findAndCountAll({
        where: { patientId },
        attributes: ['id', 'date', 'medicId', 'organizationId'],
        order: [['date', 'DESC']],
        limit: count,
        offset,
      });

      const docRefs = rows.map((row): DocumentReference => {
        const plain = row.get({ plain: true }) as Record<string, unknown>;
        return {
          resourceType: 'DocumentReference',
          id: plain.id as string,
          meta: {
            profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/DocumentReference-ar-core'],
          },
          status: 'current',
          type: {
            coding: [{
              system: 'http://loinc.org',
              code: '34133-9',
              display: 'Summary of episode note',
            }],
          },
          subject: {
            reference: `Patient/${patientId}`,
          },
          date: (plain.date as Date)?.toISOString?.() || undefined,
          author: [{
            reference: `Practitioner/${plain.medicId}`,
          }],
          content: [{
            attachment: {
              contentType: 'application/fhir+json',
              url: `${DOMAIN_SYSTEM}/Binary/${plain.id}`,
            },
          }],
        };
      });

      res.json(createSearchBundle(docRefs, total));
    } catch (error) {
      console.error('Error searching document references:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
