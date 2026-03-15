import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Models } from '../models';
import { mapOrganization } from '../mappers/organization.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';

export function createOrganizationRoutes(models: Models): Router {
  const router = Router();

  // GET /Organization - Search
  router.get('/Organization', async (req: Request, res: Response) => {
    try {
      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);
      const where: Record<string, unknown> = {};

      const id = req.query._id as string | undefined;
      if (id) {
        where.id = id;
      }

      const name = req.query.name as string | undefined;
      if (name) {
        where.name = { [Op.iLike]: `%${name}%` };
      }

      const identifier = req.query.identifier as string | undefined;
      if (identifier) {
        const parts = identifier.split('|');
        const value = parts.length > 1 ? parts[1] : parts[0];
        where[Op.or as unknown as string] = [
          { id: value },
          { 'settings.refesId': value },
        ];
      }

      const { rows, count: total } = await models.organizations.findAndCountAll({
        where,
        limit: count,
        offset,
      });

      const organizations = rows.map((row) => mapOrganization(row.get({ plain: true })));
      res.json(createSearchBundle(organizations, total));
    } catch (error) {
      console.error('Error searching organizations:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  // GET /Organization/:id - Read
  router.get('/Organization/:id', async (req: Request, res: Response) => {
    try {
      const row = await models.organizations.findByPk(req.params.id);

      if (!row) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `Organization/${req.params.id} not found`)
        );
        return;
      }

      res.json(mapOrganization(row.get({ plain: true })));
    } catch (error) {
      console.error('Error reading organization:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
