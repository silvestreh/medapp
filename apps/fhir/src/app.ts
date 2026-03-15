import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Models } from './models';
import { jwtMiddleware } from './auth/jwt-middleware';
import { generalLimiter } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import metadataRoutes from './routes/metadata.routes';
import { createPatientRoutes } from './routes/patient.routes';
import { createPractitionerRoutes } from './routes/practitioner.routes';
import { createOrganizationRoutes } from './routes/organization.routes';
import { createConditionRoutes } from './routes/condition.routes';
import { createAllergyIntoleranceRoutes } from './routes/allergy-intolerance.routes';
import { createMedicationStatementRoutes } from './routes/medication-statement.routes';
import { createPatientSummaryRoutes } from './routes/patient-summary.routes';
import { createDocumentReferenceRoutes } from './routes/document-reference.routes';
import { createBinaryRoutes } from './routes/binary.routes';
import { createConsentRoutes } from './routes/consent.routes';
import { createOperationOutcome } from './utils/fhir-helpers';

export function createApp(models: Models): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

  // Logging & rate limiting
  app.use(requestLogger);
  app.use(generalLimiter);

  // Set FHIR content type on all responses
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/fhir+json; fhirVersion=4.0');
    next();
  });

  // Auth
  app.use(jwtMiddleware);

  // Routes
  app.use(metadataRoutes);
  app.use(createPatientRoutes(models));
  app.use(createPractitionerRoutes(models));
  app.use(createOrganizationRoutes(models));
  app.use(createConditionRoutes(models));
  app.use(createAllergyIntoleranceRoutes(models));
  app.use(createMedicationStatementRoutes(models));
  app.use(createPatientSummaryRoutes(models));
  app.use(createDocumentReferenceRoutes(models));
  app.use(createBinaryRoutes(models));
  app.use(createConsentRoutes());

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json(
      createOperationOutcome('error', 'not-found', 'Resource not found')
    );
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json(
      createOperationOutcome('error', 'exception', 'Internal server error')
    );
  });

  return app;
}
