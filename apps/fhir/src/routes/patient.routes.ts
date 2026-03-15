import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Models } from '../models';
import { mapPatient } from '../mappers/patient.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';
import { decryptPatientRecord, encryptValue } from '../utils/decrypt';

export function createPatientRoutes(models: Models): Router {
  const router = Router();

  // GET /Patient - Search
  router.get('/Patient', async (req: Request, res: Response) => {
    try {
      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);
      const where: Record<string, unknown> = { deleted: false };
      const personalDataWhere: Record<string, unknown> = {};

      const id = req.query._id as string | undefined;
      if (id) {
        where.id = id;
      }

      const identifier = req.query.identifier as string | undefined;
      if (identifier) {
        // identifier format: system|value or just value
        const parts = identifier.split('|');
        const value = parts.length > 1 ? parts[1] : parts[0];
        // documentValue is stored encrypted (AES-256-ECB, deterministic) — encrypt the search value
        personalDataWhere.documentValue = encryptValue(value);
      }

      const name = req.query.name as string | undefined;
      if (name) {
        personalDataWhere[Op.or as unknown as string] = [
          { firstName: { [Op.iLike]: `%${name}%` } },
          { lastName: { [Op.iLike]: `%${name}%` } },
        ];
      }

      const birthdate = req.query.birthdate as string | undefined;
      if (birthdate) {
        // birthDate is stored encrypted (AES-256-ECB, deterministic) — encrypt the search value
        personalDataWhere.birthDate = encryptValue(birthdate);
      }

      const gender = req.query.gender as string | undefined;
      if (gender) {
        personalDataWhere.gender = gender;
      }

      const hasPersonalDataFilter = Object.keys(personalDataWhere).length > 0;

      const { rows, count: total } = await models.patients.findAndCountAll({
        where,
        include: [
          {
            model: models.personal_data,
            ...(hasPersonalDataFilter ? { where: personalDataWhere } : {}),
            required: hasPersonalDataFilter,
          },
          { model: models.contact_data },
        ],
        limit: count,
        offset,
        distinct: true,
      });

      const patients = rows.map((row) => mapPatient(decryptPatientRecord(row.get({ plain: true }))));
      res.json(createSearchBundle(patients, total));
    } catch (error) {
      console.error('Error searching patients:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  // GET /Patient/:id - Read
  router.get('/Patient/:id', async (req: Request, res: Response) => {
    try {
      const row = await models.patients.findByPk(req.params.id, {
        include: [
          { model: models.personal_data },
          { model: models.contact_data },
        ],
      });

      if (!row) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `Patient/${req.params.id} not found`)
        );
        return;
      }

      const internal = row.get({ plain: true });
      if (internal.deleted) {
        res.status(410).json(
          createOperationOutcome('error', 'deleted', `Patient/${req.params.id} has been deleted`)
        );
        return;
      }

      res.json(mapPatient(decryptPatientRecord(internal)));
    } catch (error) {
      console.error('Error reading patient:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  // POST /Patient/$match - Demographic matching (used by the Bus)
  router.post('/Patient/\\$match', async (req: Request, res: Response) => {
    try {
      const params = req.body;

      // Extract parameters from FHIR Parameters resource
      let family: string | undefined;
      let given: string | undefined;
      let identifier: string | undefined;
      let gender: string | undefined;
      let birthdate: string | undefined;

      if (params.resourceType === 'Parameters' && Array.isArray(params.parameter)) {
        for (const p of params.parameter) {
          if (p.name === 'resource' && p.resource?.resourceType === 'Patient') {
            const patient = p.resource;
            family = patient.name?.[0]?.family;
            given = patient.name?.[0]?.given?.[0];
            gender = patient.gender;
            birthdate = patient.birthDate;
            identifier = patient.identifier?.[0]?.value;
          }
        }
      }

      if (!family && !given && !identifier) {
        res.status(400).json(
          createOperationOutcome('error', 'required', '$match requires at least a name or identifier')
        );
        return;
      }

      const where: Record<string, unknown> = { deleted: false };
      const personalDataWhere: Record<string, unknown> = {};

      if (identifier) {
        personalDataWhere.documentValue = encryptValue(identifier);
      }

      const nameConditions: Record<string, unknown>[] = [];
      if (family) {
        nameConditions.push({ lastName: { [Op.iLike]: `%${family}%` } });
      }
      if (given) {
        nameConditions.push({ firstName: { [Op.iLike]: `%${given}%` } });
      }
      if (nameConditions.length > 0) {
        personalDataWhere[Op.and as unknown as string] = nameConditions;
      }
      if (gender) {
        personalDataWhere.gender = gender;
      }
      if (birthdate) {
        personalDataWhere.birthDate = encryptValue(birthdate);
      }

      const hasPersonalDataFilter = Object.keys(personalDataWhere).length > 0;

      const { rows } = await models.patients.findAndCountAll({
        where,
        include: [
          {
            model: models.personal_data,
            ...(hasPersonalDataFilter ? { where: personalDataWhere } : {}),
            required: hasPersonalDataFilter,
          },
          { model: models.contact_data },
        ],
        limit: 5,
        distinct: true,
      });

      const patients = rows.map((row) => {
        const internal = decryptPatientRecord(row.get({ plain: true }));
        const pd = internal.personal_data?.[0];
        const resource = mapPatient(internal);

        // Calculate match score based on how many fields match
        let score = 0;
        let maxScore = 0;

        if (identifier) {
          maxScore += 3;
          if (pd?.documentValue === identifier) score += 3;
        }
        if (family) {
          maxScore += 2;
          if (pd?.lastName?.toLowerCase() === family.toLowerCase()) score += 2;
          else if (pd?.lastName?.toLowerCase().includes(family.toLowerCase())) score += 1;
        }
        if (given) {
          maxScore += 1;
          if (pd?.firstName?.toLowerCase() === given.toLowerCase()) score += 1;
        }
        if (birthdate) {
          maxScore += 2;
          if (pd?.birthDate === birthdate) score += 2;
        }
        if (gender) {
          maxScore += 1;
          if (pd?.gender === gender) score += 1;
        }

        const normalizedScore = maxScore > 0 ? Math.round((score / maxScore) * 100) / 100 : 0;

        return {
          resource,
          search: { mode: 'match' as const, score: normalizedScore },
        };
      });

      // Sort by score descending
      patients.sort((a, b) => (b.search.score || 0) - (a.search.score || 0));

      res.json({
        resourceType: 'Bundle',
        type: 'searchset',
        total: patients.length,
        entry: patients.map((p) => ({
          fullUrl: `Patient/${p.resource.id}`,
          resource: p.resource,
          search: p.search,
        })),
      });
    } catch (error) {
      console.error('Error in $match:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
