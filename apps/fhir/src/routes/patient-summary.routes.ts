import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { mapPatient } from '../mappers/patient.mapper';
import { mapPractitioner } from '../mappers/practitioner.mapper';
import { mapOrganization } from '../mappers/organization.mapper';
import { mapConditions } from '../mappers/condition.mapper';
import { mapDrugAllergies, mapGeneralAllergies } from '../mappers/allergy-intolerance.mapper';
import { mapMedicationHistory, mapPrescriptionMedications } from '../mappers/medication-statement.mapper';
import { mapComposition } from '../mappers/composition.mapper';
import { mapIpsBundle } from '../mappers/bundle.mapper';
import { parseEncounterData } from '../utils/encounter-parser';
import { createOperationOutcome } from '../utils/fhir-helpers';
import { summaryLimiter } from '../middleware/rate-limit';
import { decryptPatientRecord } from '../utils/decrypt';
import type { Condition, AllergyIntolerance, MedicationStatement } from '@medplum/fhirtypes';

export function createPatientSummaryRoutes(models: Models): Router {
  const router = Router();

  // GET /Patient/:id/$summary - Generate IPS Bundle
  router.get('/Patient/:id/\\$summary', summaryLimiter, async (req: Request, res: Response) => {
    try {
      const patientId = req.params.id;

      // Fetch patient with personal data and contact data
      const patientRow = await models.patients.findByPk(patientId, {
        include: [
          { model: models.personal_data },
          { model: models.contact_data },
        ],
      });

      if (!patientRow) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `Patient/${patientId} not found`)
        );
        return;
      }

      const patientInternal = decryptPatientRecord(patientRow.get({ plain: true }));
      if (patientInternal.deleted) {
        res.status(410).json(
          createOperationOutcome('error', 'deleted', `Patient/${patientId} has been deleted`)
        );
        return;
      }

      // Find the most recent encounter to determine the practitioner and organization
      const latestEncounter = await models.encounters.findOne({
        where: { patientId },
        order: [['date', 'DESC']],
        raw: true,
      });

      if (!latestEncounter) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `No encounters found for Patient/${patientId}`)
        );
        return;
      }

      const encPlain = latestEncounter as unknown as Record<string, unknown>;
      const medicId = encPlain.medicId as string;
      const organizationId = encPlain.organizationId as string;

      // Fetch practitioner
      const practitionerRow = await models.users.findByPk(medicId, {
        include: [
          { model: models.personal_data },
          { model: models.contact_data },
          { model: models.md_settings },
        ],
      });

      // Fetch organization
      const orgRow = await models.organizations.findByPk(organizationId);

      if (!practitionerRow || !orgRow) {
        res.status(500).json(
          createOperationOutcome('error', 'exception', 'Could not resolve practitioner or organization')
        );
        return;
      }

      // Map base resources
      const patientResource = mapPatient(patientInternal);
      const practitionerResource = mapPractitioner(decryptPatientRecord(practitionerRow.get({ plain: true })));
      const orgResource = mapOrganization(orgRow.get({ plain: true }));

      // Fetch all encounters for clinical data
      const allEncounters = await models.encounters.findAll({
        where: { patientId },
        attributes: (models.encounters.decryptedAttributes as string[]) || undefined,
        order: [['date', 'DESC']],
        raw: true,
      });

      // Build ICD-10 lookup
      const icdCodes = new Set<string>();
      const allConditions: Condition[] = [];
      const allAllergies: AllergyIntolerance[] = [];
      const allMedications: MedicationStatement[] = [];

      // First pass: collect ICD codes
      for (const enc of allEncounters) {
        const plain = enc as unknown as Record<string, unknown>;
        const parsed = parseEncounterData(plain.data);
        for (const c of parsed.conditions) icdCodes.add(c.issueId);
      }

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

      // Second pass: extract clinical resources
      for (const enc of allEncounters) {
        const plain = enc as unknown as Record<string, unknown>;
        const parsed = parseEncounterData(plain.data);
        const ctx = {
          encounterId: plain.id as string,
          patientId,
          medicId: plain.medicId as string,
          encounterDate: (plain.date as Date)?.toISOString?.() || '',
        };

        if (parsed.conditions.length > 0) {
          allConditions.push(...mapConditions(parsed.conditions, ctx, icdLookup));
        }

        const allergyCtx = { encounterId: ctx.encounterId, patientId, medicId: ctx.medicId };
        if (parsed.drugAllergies.length > 0) {
          allAllergies.push(...mapDrugAllergies(parsed.drugAllergies, allergyCtx));
        }
        if (Object.keys(parsed.generalAllergies).length > 0) {
          allAllergies.push(...mapGeneralAllergies(parsed.generalAllergies, allergyCtx));
        }

        if (parsed.medications.length > 0) {
          allMedications.push(...mapMedicationHistory(parsed.medications, {
            patientId,
            medicId: ctx.medicId,
            encounterId: ctx.encounterId,
          }));
        }
      }

      // Also pull prescription-based medications
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
            content: plain.content as { diagnosis?: string; medicines?: { text: string; posology?: string }[] },
            status: plain.status as string,
          };
        });
        const firstRx = prescriptions[0] as unknown as Record<string, unknown>;
        allMedications.push(...mapPrescriptionMedications(rxInputs, {
          patientId,
          medicId: firstRx.medicId as string,
        }));
      }

      // Build IPS Composition
      const composition = mapComposition({
        patientId,
        practitionerId: medicId,
        organizationId,
        conditions: allConditions,
        allergies: allAllergies,
        medications: allMedications,
      });

      // Build IPS Bundle
      const bundle = mapIpsBundle({
        composition,
        patient: patientResource,
        practitioner: practitionerResource,
        organization: orgResource,
        conditions: allConditions,
        allergies: allAllergies,
        medications: allMedications,
      });

      res.json(bundle);
    } catch (error) {
      console.error('Error generating IPS summary:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
