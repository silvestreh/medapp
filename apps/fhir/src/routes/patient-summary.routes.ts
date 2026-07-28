import { Router, Request, Response } from 'express';
import { Models } from '../models';
import { mapPatient } from '../mappers/patient.mapper';
import { mapPractitioner } from '../mappers/practitioner.mapper';
import { mapOrganization } from '../mappers/organization.mapper';
import { mapConditions, mapNoKnownProblems } from '../mappers/condition.mapper';
import { mapDrugAllergies, mapGeneralAllergies, mapNoKnownAllergies } from '../mappers/allergy-intolerance.mapper';
import { mapMedicationHistory, mapPrescriptionMedications, mapNoKnownMedications } from '../mappers/medication-statement.mapper';
import { mapComposition } from '../mappers/composition.mapper';
import { mapIpsBundle } from '../mappers/bundle.mapper';
import { parseEncounterData } from '../utils/encounter-parser';
import { createOperationOutcome } from '../utils/fhir-helpers';
import { AR_SYSTEMS, FEDERADOR_URI_SYSTEM, FEDERADOR_DOMAIN_ID } from '../utils/identifiers';
import { summaryLimiter } from '../middleware/rate-limit';
import { decryptPatientRecord } from '../utils/decrypt';
import type { Condition, AllergyIntolerance, MedicationStatement, Practitioner } from '@medplum/fhirtypes';

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

      // Fetch author practitioner (for the Composition.author identifier)
      const practitionerRow = await models.users.findByPk(medicId, {
        include: [
          { model: models.personal_data },
          { model: models.contact_data },
          { model: models.md_settings },
        ],
      });

      // Fetch organization (for the Composition.custodian identifier)
      const orgRow = await models.organizations.findByPk(organizationId);

      if (!practitionerRow || !orgRow) {
        res.status(500).json(
          createOperationOutcome('error', 'exception', 'Could not resolve practitioner or organization')
        );
        return;
      }

      // Map base resources
      const patientResource = mapPatient(patientInternal);
      const authorPlain = decryptPatientRecord(practitionerRow.get({ plain: true }));
      const orgPlain = orgRow.get({ plain: true }) as {
        id: string; name: string; slug: string; settings: Record<string, unknown>; isActive: boolean;
      };

      // Canonical Organization: use the official REFES establishment name
      // from the local mirror when available.
      const orgRefesId = orgPlain.settings?.refesId as string | undefined;
      let officialName: string | undefined;
      if (orgRefesId) {
        const refesRecord = await models.refes_establishments.findByPk(orgRefesId, { raw: true });
        officialName = (refesRecord as unknown as { name?: string } | null)?.name;
      }
      const organizationResource = mapOrganization(orgPlain, officialName);

      // The organization has no author/custodian reference pointing at it
      // (forbidden by the profile) — link it via managingOrganization so it
      // stays reachable within the document bundle.
      patientResource.managingOrganization = { reference: `Organization/${organizationResource.id}` };

      // Composition-ar-ips-core requires author/custodian as logical
      // identifiers (references are forbidden): the author is the
      // institution in the REFES namespace, the custodian is the domain
      // registered with the national federator.
      const authorIdentifier = orgRefesId
        ? { system: AR_SYSTEMS.REFES, value: orgRefesId }
        : { value: organizationId };
      const custodianIdentifier = { system: FEDERADOR_URI_SYSTEM, value: FEDERADOR_DOMAIN_ID };

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
      // Practitioners referenced by clinical resources — each must be a
      // bundle entry so every reference in the document resolves.
      const referencedMedicIds = new Set<string>();

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
        const encounterDate = (plain.date as Date)?.toISOString?.() || '';
        const ctx = {
          encounterId: plain.id as string,
          patientId,
          medicId: plain.medicId as string,
          encounterDate,
        };

        const hasClinicalData = parsed.conditions.length > 0
          || parsed.drugAllergies.length > 0
          || Object.keys(parsed.generalAllergies).length > 0
          || parsed.medications.length > 0;
        if (hasClinicalData && ctx.medicId) {
          referencedMedicIds.add(ctx.medicId);
        }

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
            encounterDate,
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
          const rxMedicId = plain.medicId as string | undefined;
          if (rxMedicId) referencedMedicIds.add(rxMedicId);
          return {
            id: plain.id as string,
            content: plain.content as { diagnosis?: string; medicines?: { text: string; posology?: string }[] },
            status: plain.status as string,
            date: (plain.createdAt as Date)?.toISOString?.() || undefined,
            medicId: rxMedicId,
          };
        });
        const firstRx = prescriptions[0] as unknown as Record<string, unknown>;
        allMedications.push(...mapPrescriptionMedications(rxInputs, {
          patientId,
          medicId: firstRx.medicId as string,
        }));
      }

      // Map every referenced practitioner into a bundle entry
      const practitionerResources: Practitioner[] = [];
      for (const refMedicId of referencedMedicIds) {
        const row = refMedicId === medicId
          ? practitionerRow
          : await models.users.findByPk(refMedicId, {
            include: [
              { model: models.personal_data },
              { model: models.md_settings },
            ],
          });
        if (row) {
          const plain = refMedicId === medicId ? authorPlain : decryptPatientRecord(row.get({ plain: true }));
          practitionerResources.push(mapPractitioner(plain));
        }
      }

      // IPS placeholders: empty sections carry an explicit absent/unknown
      // resource (this also keeps the Bundle at the >= 6 entries the AR
      // profile requires).
      const conditions = allConditions.length > 0 ? allConditions : [mapNoKnownProblems(patientId)];
      const allergies = allAllergies.length > 0 ? allAllergies : [mapNoKnownAllergies(patientId)];
      const medications = allMedications.length > 0 ? allMedications : [mapNoKnownMedications(patientId)];

      // Build IPS Composition
      const composition = mapComposition({
        patientId,
        authorIdentifier,
        custodianIdentifier,
        conditions,
        allergies,
        medications,
      });

      // Build IPS Bundle
      const bundle = mapIpsBundle({
        composition,
        patient: patientResource,
        organization: organizationResource,
        practitioners: practitionerResources,
        conditions,
        allergies,
        medications,
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
