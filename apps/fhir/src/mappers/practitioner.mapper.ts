import type { Practitioner, Identifier, Extension } from '@medplum/fhirtypes';
import { AR_SYSTEMS, DOMAIN_SYSTEM } from '../utils/identifiers';

interface PersonalData {
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentValue: string;
  gender?: string;
  birthDate?: string;
}

interface MdSettings {
  medicalSpecialty?: string;
  nationalLicenseNumber?: string;
  stateLicense?: string;
  stateLicenseNumber?: string;
  title?: string;
  isVerified: boolean;
}

interface InternalPractitioner {
  id: string;
  personal_data?: PersonalData[];
  md_setting?: MdSettings;
}

function buildIdentifiers(user: InternalPractitioner, pd: PersonalData): Identifier[] {
  const identifiers: Identifier[] = [];

  // DocumentoUnico (DNI)
  identifiers.push({
    use: 'official',
    type: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'NI' }],
      text: 'DNI',
    },
    system: AR_SYSTEMS.DNI,
    value: pd.documentValue,
    assigner: { display: 'RENAPER' },
  });

  // REFEPSid
  const mds = user.md_setting;
  if (mds?.nationalLicenseNumber) {
    identifiers.push({
      use: 'official',
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'AC' }],
        text: 'REFEPS',
      },
      system: AR_SYSTEMS.REFEPS,
      value: mds.nationalLicenseNumber,
    });
  }

  // Domain identifier
  identifiers.push({
    use: 'usual',
    system: DOMAIN_SYSTEM,
    value: user.id,
  });

  return identifiers;
}

interface HumanNameWithExtensions {
  use: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  _family?: { extension: Extension[] };
}

function buildName(pd: PersonalData, mds?: MdSettings): HumanNameWithExtensions[] {
  const fathersFamily: Extension = {
    url: 'http://hl7.org/fhir/StructureDefinition/humanname-fathers-family',
    valueString: pd.lastName || '',
  };

  return [{
    use: 'official',
    family: pd.lastName || undefined,
    given: pd.firstName ? [pd.firstName] : undefined,
    prefix: mds?.title ? [mds.title] : undefined,
    _family: pd.lastName ? { extension: [fathersFamily] } : undefined,
  }];
}

export function mapPractitioner(internal: InternalPractitioner): Practitioner {
  const pd = internal.personal_data?.[0];
  const mds = internal.md_setting;

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    id: internal.id,
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Practitioner-ar-core'],
    },
    active: true,
  };

  if (pd) {
    practitioner.identifier = buildIdentifiers(internal, pd);
    // Cast needed: _family extension is valid FHIR but not in @medplum/fhirtypes
    practitioner.name = buildName(pd, mds) as Practitioner['name'];
    practitioner.gender = (pd.gender as Practitioner['gender']) || undefined;
    practitioner.birthDate = pd.birthDate || undefined;
  }

  if (mds?.medicalSpecialty) {
    practitioner.qualification = [{
      code: {
        text: mds.medicalSpecialty,
      },
    }];

    if (mds.stateLicense && mds.stateLicenseNumber) {
      practitioner.qualification.push({
        identifier: [{
          system: `http://fhir.msal.gob.ar/core/licenses/${mds.stateLicense}`,
          value: mds.stateLicenseNumber,
        }],
        code: {
          text: `${mds.stateLicense} License`,
        },
      });
    }
  }

  return practitioner;
}
