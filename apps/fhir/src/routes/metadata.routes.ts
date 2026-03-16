import { Router } from 'express';
import type { CapabilityStatement } from '@medplum/fhirtypes';

const router = Router();

router.get('/metadata', (_req, res) => {
  const capability: CapabilityStatement = {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['json'],
    software: {
      name: 'Athelas FHIR Wrapper',
      version: '0.0.1',
    },
    implementation: {
      description: 'Athelas FHIR Wrapper - HL7 Argentina AR.FHIR.CORE',
    },
    rest: [{
      mode: 'server',
      security: {
        cors: true,
        service: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
            code: 'SMART-on-FHIR',
          }],
          text: 'OAuth2 with JWT Bearer tokens (DNSIS Bus)',
        }],
      },
      resource: [
        {
          type: 'Patient',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/Patient-ar-core',
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
          ],
          searchParam: [
            { name: '_id', type: 'token' },
            { name: 'identifier', type: 'token' },
            { name: 'name', type: 'string' },
            { name: 'birthdate', type: 'date' },
            { name: 'gender', type: 'token' },
          ],
          operation: [
            {
              name: 'summary',
              definition: 'http://hl7.org/fhir/OperationDefinition/Patient-summary',
            },
            {
              name: 'match',
              definition: 'http://hl7.org/fhir/OperationDefinition/Patient-match',
            },
          ],
        },
        {
          type: 'Practitioner',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/Practitioner-ar-core',
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
          ],
          searchParam: [
            { name: '_id', type: 'token' },
            { name: 'identifier', type: 'token' },
            { name: 'name', type: 'string' },
          ],
        },
        {
          type: 'Organization',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/Organization-ar-core',
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
          ],
          searchParam: [
            { name: '_id', type: 'token' },
            { name: 'identifier', type: 'token' },
            { name: 'name', type: 'string' },
          ],
        },
        {
          type: 'Condition',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/Condition-ar-core',
          interaction: [
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
          ],
        },
        {
          type: 'AllergyIntolerance',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/AllergyIntolerance-ar-core',
          interaction: [
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
          ],
        },
        {
          type: 'MedicationStatement',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/MedicationStatement-ar-core',
          interaction: [
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
          ],
        },
        {
          type: 'DocumentReference',
          profile: 'http://fhir.msal.gob.ar/core/StructureDefinition/DocumentReference-ar-core',
          interaction: [
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
          ],
        },
        {
          type: 'Binary',
          interaction: [
            { code: 'read' },
          ],
        },
        {
          type: 'Consent',
          interaction: [
            { code: 'search-type' },
          ],
        },
        {
          type: 'AuditEvent',
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
            { name: 'agent', type: 'reference' },
            { name: 'date', type: 'date' },
            { name: 'type', type: 'token' },
          ],
        },
      ],
    }],
  };

  res.json(capability);
});

export default router;
