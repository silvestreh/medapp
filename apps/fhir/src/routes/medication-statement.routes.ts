import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { parseEncounterData } from '../utils/encounter-parser';
import { mapMedicationHistory, mapPrescriptionMedications } from '../mappers/medication-statement.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';
import type { MedicationStatement } from '@medplum/fhirtypes';

export function createMedicationStatementRoutes(models: Models): Router {
  const router = Router();

  // GET /MedicationStatement?patient=:patientId
  router.get('/MedicationStatement', async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patient as string | undefined;
      if (!patientId) {
        res.status(400).json(
          createOperationOutcome('error', 'required', 'Search parameter "patient" is required')
        );
        return;
      }

      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);

      // Get medications from encounter history
      const encounters = await models.encounters.findAll({
        where: { patientId },
        attributes: (models.encounters.decryptedAttributes as string[]) || undefined,
        order: [['date', 'DESC']],
        raw: true,
      });

      const allStatements: MedicationStatement[] = [];

      for (const enc of encounters) {
        const plain = enc as unknown as Record<string, unknown>;
        const parsed = parseEncounterData(plain.data);

        if (parsed.medications.length > 0) {
          allStatements.push(...mapMedicationHistory(parsed.medications, {
            patientId: plain.patientId as string,
            medicId: plain.medicId as string,
            encounterId: plain.id as string,
          }));
        }
      }

      // Get medications from prescriptions
      const prescriptions = await models.prescriptions.findAll({
        where: { patientId, type: 'prescription' },
        order: [['createdAt', 'DESC']],
        raw: true,
      });

      if (prescriptions.length > 0) {
        const rxInputs = prescriptions.map((rx) => {
          const plain = rx as unknown as Record<string, unknown>;
          return {
            id: plain.id as string,
            content: plain.content as { diagnosis?: string; medicines?: { text: string; posology?: string; medicationId?: string }[] },
            status: plain.status as string,
          };
        });

        // Use the first prescription's medicId as context
        const firstRx = prescriptions[0] as unknown as Record<string, unknown>;
        allStatements.push(...mapPrescriptionMedications(rxInputs, {
          patientId,
          medicId: firstRx.medicId as string,
        }));
      }

      const total = allStatements.length;
      const paginated = allStatements.slice(offset, offset + count);
      res.json(createSearchBundle(paginated, total));
    } catch (error) {
      console.error('Error searching medication statements:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
