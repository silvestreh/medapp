import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { Models } from '../models';
import { mapAuditEvent } from '../mappers/audit-event.mapper';
import { createSearchBundle, createOperationOutcome, parseFhirSearchParams } from '../utils/fhir-helpers';

export function createAuditEventRoutes(models: Models): Router {
  const router = Router();

  // GET /AuditEvent?patient=:patientId&date=:date&agent=:userId&type=:resource
  router.get('/AuditEvent', async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patient as string | undefined;
      const agent = req.query.agent as string | undefined;
      const date = req.query.date as string | undefined;
      const type = req.query.type as string | undefined;

      const { count, offset } = parseFhirSearchParams(req.query as Record<string, string>);

      const where: Record<string, unknown> = {};

      if (patientId) where.patientId = patientId;
      if (agent) where.userId = agent;
      if (type) where.resource = type;

      // FHIR date prefix support (ge, le, eq)
      if (date) {
        const dateFilters = Array.isArray(date) ? date : [date];
        for (const df of dateFilters) {
          const str = df as string;
          if (str.startsWith('ge')) {
            where.createdAt = { ...(where.createdAt as object || {}), [Op.gte]: new Date(str.slice(2)) };
          } else if (str.startsWith('le')) {
            where.createdAt = { ...(where.createdAt as object || {}), [Op.lte]: new Date(str.slice(2)) };
          } else if (str.startsWith('eq')) {
            where.createdAt = { ...(where.createdAt as object || {}), [Op.eq]: new Date(str.slice(2)) };
          } else {
            // Default: exact or starts-with date
            where.createdAt = { ...(where.createdAt as object || {}), [Op.gte]: new Date(str) };
          }
        }
      }

      const { rows, count: total } = await models.access_logs.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: count,
        offset,
        raw: true,
      });

      const auditEvents = rows.map((row) => {
        const plain = row as unknown as Record<string, unknown>;
        return mapAuditEvent({
          id: plain.id as string,
          userId: plain.userId as string,
          organizationId: plain.organizationId as string | null,
          resource: plain.resource as string,
          patientId: plain.patientId as string | null,
          action: plain.action as string,
          purpose: plain.purpose as string,
          refesId: plain.refesId as string | null,
          hash: plain.hash as string | null,
          previousLogId: plain.previousLogId as string | null,
          ip: plain.ip as string | null,
          metadata: plain.metadata as Record<string, any> | null,
          createdAt: plain.createdAt as string,
        });
      });

      res.json(createSearchBundle(auditEvents, total));
    } catch (error) {
      console.error('Error searching audit events:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  // GET /AuditEvent/:id
  router.get('/AuditEvent/:id', async (req: Request, res: Response) => {
    try {
      const log = await models.access_logs.findByPk(req.params.id, { raw: true });

      if (!log) {
        res.status(404).json(
          createOperationOutcome('error', 'not-found', 'AuditEvent not found')
        );
        return;
      }

      const plain = log as unknown as Record<string, unknown>;
      const auditEvent = mapAuditEvent({
        id: plain.id as string,
        userId: plain.userId as string,
        organizationId: plain.organizationId as string | null,
        resource: plain.resource as string,
        patientId: plain.patientId as string | null,
        action: plain.action as string,
        purpose: plain.purpose as string,
        refesId: plain.refesId as string | null,
        hash: plain.hash as string | null,
        previousLogId: plain.previousLogId as string | null,
        ip: plain.ip as string | null,
        metadata: plain.metadata as Record<string, any> | null,
        createdAt: plain.createdAt as string,
      });

      res.json(auditEvent);
    } catch (error) {
      console.error('Error reading audit event:', error);
      res.status(500).json(
        createOperationOutcome('error', 'exception', 'Internal server error')
      );
    }
  });

  return router;
}
