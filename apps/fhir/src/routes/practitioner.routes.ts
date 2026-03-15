import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Models } from '../models';
import { mapPractitioner } from '../mappers/practitioner.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';
import { decryptPatientRecord, encryptValue } from '../utils/decrypt';

export function createPractitionerRoutes(models: Models): Router {
  const router = Router();

  // GET /Practitioner - Search
  router.get('/Practitioner', async (req: Request, res: Response) => {
    try {
      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);
      const where: Record<string, unknown> = {};
      const personalDataWhere: Record<string, unknown> = {};

      const id = req.query._id as string | undefined;
      if (id) {
        where.id = id;
      }

      const identifier = req.query.identifier as string | undefined;
      if (identifier) {
        const parts = identifier.split('|');
        const value = parts.length > 1 ? parts[1] : parts[0];
        personalDataWhere.documentValue = encryptValue(value);
      }

      const name = req.query.name as string | undefined;
      if (name) {
        personalDataWhere[Op.or as unknown as string] = [
          { firstName: { [Op.iLike]: `%${name}%` } },
          { lastName: { [Op.iLike]: `%${name}%` } },
        ];
      }

      const hasPersonalDataFilter = Object.keys(personalDataWhere).length > 0;

      const { rows, count: total } = await models.users.findAndCountAll({
        where,
        include: [
          {
            model: models.personal_data,
            ...(hasPersonalDataFilter ? { where: personalDataWhere } : {}),
            required: hasPersonalDataFilter,
          },
          { model: models.contact_data },
          { model: models.md_settings },
        ],
        limit: count,
        offset,
        distinct: true,
      });

      const practitioners = rows.map((row) => mapPractitioner(decryptPatientRecord(row.get({ plain: true }))));
      res.json(createSearchBundle(practitioners, total));
    } catch (error) {
      console.error('Error searching practitioners:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  // GET /Practitioner/:id - Read
  router.get('/Practitioner/:id', async (req: Request, res: Response) => {
    try {
      const row = await models.users.findByPk(req.params.id, {
        include: [
          { model: models.personal_data },
          { model: models.contact_data },
          { model: models.md_settings },
        ],
      });

      if (!row) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `Practitioner/${req.params.id} not found`)
        );
        return;
      }

      res.json(mapPractitioner(decryptPatientRecord(row.get({ plain: true }))));
    } catch (error) {
      console.error('Error reading practitioner:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
