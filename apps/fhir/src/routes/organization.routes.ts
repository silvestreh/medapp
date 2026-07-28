import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Models } from '../models';
import { mapOrganization } from '../mappers/organization.mapper';
import { dedupeOrganizationRows, collectRefesIds, OrganizationRow } from '../utils/organization-dedupe';
import { createSearchBundle, absoluteSelfUrl, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';

const REFES_ID_PREFIX = 'refes-';

export function createOrganizationRoutes(models: Models): Router {
  const router = Router();

  // Official establishment names from the local REFES mirror (synced by
  // apps/api). Falls back silently when the mirror is empty.
  async function lookupRefesNames(refesIds: string[]): Promise<Record<string, string>> {
    if (refesIds.length === 0) return {};
    const records = await models.refes_establishments.findAll({
      where: { id: { [Op.in]: refesIds } },
      raw: true,
    });
    const names: Record<string, string> = {};
    for (const rec of records as unknown as { id: string; name: string }[]) {
      names[rec.id] = rec.name;
    }
    return names;
  }

  // GET /Organization - Search
  router.get('/Organization', async (req: Request, res: Response) => {
    try {
      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);
      const where: Record<string, unknown> = {};

      const id = req.query._id as string | undefined;
      if (id) {
        if (id.startsWith(REFES_ID_PREFIX)) {
          where['settings.refesId'] = id.slice(REFES_ID_PREFIX.length);
        } else {
          where.id = id;
        }
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

      // Tenant rows sharing a REFES id collapse into one canonical
      // Organization, so pagination applies after deduplication.
      const rows = await models.organizations.findAll({ where });
      const deduped = dedupeOrganizationRows(
        rows.map((row) => row.get({ plain: true }) as OrganizationRow)
      );
      const refesNames = await lookupRefesNames(collectRefesIds(deduped));

      const page = deduped.slice(offset, offset + count);
      const organizations = page.map((row) =>
        mapOrganization(row, refesNames[row.settings?.refesId as string])
      );
      res.json(createSearchBundle(organizations, deduped.length, absoluteSelfUrl(req.originalUrl)));
    } catch (error) {
      console.error('Error searching organizations:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  // GET /Organization/:id - Read
  // Accepts both the canonical id (refes-<code>) and a tenant org uuid;
  // either way the canonical resource is returned.
  router.get('/Organization/:id', async (req: Request, res: Response) => {
    try {
      const requestedId = req.params.id;
      let rows: OrganizationRow[];

      if (requestedId.startsWith(REFES_ID_PREFIX)) {
        const found = await models.organizations.findAll({
          where: { 'settings.refesId': requestedId.slice(REFES_ID_PREFIX.length) },
        });
        rows = found.map((row) => row.get({ plain: true }) as OrganizationRow);
      } else {
        const row = await models.organizations.findByPk(requestedId);
        rows = row ? [row.get({ plain: true }) as OrganizationRow] : [];
      }

      const deduped = dedupeOrganizationRows(rows);
      if (deduped.length === 0) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', `Organization/${requestedId} not found`)
        );
        return;
      }

      const canonical = deduped[0];
      const refesNames = await lookupRefesNames(collectRefesIds([canonical]));
      res.json(mapOrganization(canonical, refesNames[canonical.settings?.refesId as string]));
    } catch (error) {
      console.error('Error reading organization:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
