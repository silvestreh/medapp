interface AnonymizeInput {
  patient: any;
  encounters: any[];
  studies?: any[];
}

interface AnonymizedEncounter {
  date: string;
  relativeDay: number;
  data: Record<string, any>;
}

interface AnonymizedStudyResult {
  type: string;
  data: Record<string, any>;
}

interface AnonymizedStudy {
  id?: string;
  date: string;
  relativeDay: number;
  protocol?: number | null;
  studies: string[];
  noOrder?: boolean;
  referringDoctor?: string | null;
  results: AnonymizedStudyResult[];
}

export interface AnonymizedEncounterHistory {
  patient: {
    id: string;
    label: string;
    ageYears?: number;
    gender?: string;
  };
  timelineStartDate: string | null;
  encounters: AnonymizedEncounter[];
  studies: AnonymizedStudy[];
}

const SENSITIVE_KEY_REGEX = /(name|firstName|lastName|document|dni|email|phone|address|street|city|province|country|birth|medicare|mugshot|avatar|photo)/i;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;
const PHONE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/g;

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function calculateAgeYears(birthDate?: string | null): number | undefined {
  const iso = toIsoDate(birthDate);
  if (!iso) return undefined;
  const now = new Date();
  const birth = new Date(iso);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
}

function buildTokenMap(patient: any): Record<string, string> {
  const personalData = patient?.personalData || {};
  const contactData = patient?.contactData || {};

  const map: Record<string, string> = {};
  const addToken = (value: unknown, replacement: string) => {
    const token = String(value || '').trim();
    if (!token) return;
    map[token] = replacement;
  };

  addToken(personalData.firstName, 'Patient_A');
  addToken(personalData.lastName, 'Patient_A');
  addToken(`${personalData.firstName || ''} ${personalData.lastName || ''}`.trim(), 'Patient_A');
  addToken(personalData.documentValue, '[REDACTED_DOCUMENT]');
  addToken(contactData.email, '[REDACTED_EMAIL]');

  const phoneNumbers = Array.isArray(contactData.phoneNumber) ? contactData.phoneNumber : [];
  for (const phone of phoneNumbers) {
    addToken(phone, '[REDACTED_PHONE]');
  }

  return map;
}

function sanitizeString(value: string, tokenMap: Record<string, string>): string {
  let nextValue = value;
  for (const [token, replacement] of Object.entries(tokenMap)) {
    if (!token) continue;
    nextValue = nextValue.split(token).join(replacement);
  }
  nextValue = nextValue.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
  nextValue = nextValue.replace(PHONE_REGEX, '[REDACTED_PHONE]');
  return nextValue;
}

function anonymizeNode(value: any, tokenMap: Record<string, string>, keyPath = ''): any {
  if (value == null) return value;

  if (typeof value === 'string') {
    return sanitizeString(value, tokenMap);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => anonymizeNode(item, tokenMap, `${keyPath}[${index}]`));
  }

  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      const fullPath = keyPath ? `${keyPath}.${key}` : key;
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED]';
        continue;
      }
      result[key] = anonymizeNode(child, tokenMap, fullPath);
    }
    return result;
  }

  return value;
}

export function anonymizeEncounterHistory(input: AnonymizeInput): AnonymizedEncounterHistory {
  const patient = input?.patient || {};
  const encounters = Array.isArray(input?.encounters) ? input.encounters : [];
  const studies = Array.isArray(input?.studies) ? input.studies : [];
  const tokenMap = buildTokenMap(patient);

  const encounterDates = encounters
    .map((encounter: any) => toIsoDate(encounter?.date))
    .filter((value: string | null): value is string => Boolean(value));
  const studyDates = studies
    .map((study: any) => toIsoDate(study?.date || study?.createdAt))
    .filter((value: string | null): value is string => Boolean(value));
  const allDates = [...encounterDates, ...studyDates].sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const sortedEncounters = [...encounters].sort((a, b) => {
    const left = new Date(String(a?.date || 0)).getTime();
    const right = new Date(String(b?.date || 0)).getTime();
    return left - right;
  });
  const sortedStudies = [...studies].sort((a, b) => {
    const left = new Date(String(a?.date || a?.createdAt || 0)).getTime();
    const right = new Date(String(b?.date || b?.createdAt || 0)).getTime();
    return left - right;
  });

  const timelineStartDate = allDates.length > 0 ? allDates[0] : null;
  const timelineAnchor = timelineStartDate ? new Date(timelineStartDate).getTime() : null;

  const normalizedEncounters = sortedEncounters.map((encounter: any): AnonymizedEncounter => {
    const encounterIso = toIsoDate(encounter?.date) || new Date().toISOString();
    const encounterTime = new Date(encounterIso).getTime();
    const relativeDay = timelineAnchor == null
      ? 0
      : Math.floor((encounterTime - timelineAnchor) / (1000 * 60 * 60 * 24));

    return {
      date: encounterIso,
      relativeDay,
      data: anonymizeNode(encounter?.data || {}, tokenMap),
    };
  });

  const normalizedStudies = sortedStudies.map((study: any): AnonymizedStudy => {
    const studyIso = toIsoDate(study?.date || study?.createdAt) || new Date().toISOString();
    const studyTime = new Date(studyIso).getTime();
    const relativeDay = timelineAnchor == null
      ? 0
      : Math.floor((studyTime - timelineAnchor) / (1000 * 60 * 60 * 24));
    const results = Array.isArray(study?.results) ? study.results : [];

    return {
      id: study?.id ? String(study.id) : undefined,
      date: studyIso,
      relativeDay,
      protocol: typeof study?.protocol === 'number' ? study.protocol : null,
      studies: Array.isArray(study?.studies) ? study.studies.map((value: any) => String(value)) : [],
      noOrder: typeof study?.noOrder === 'boolean' ? study.noOrder : undefined,
      referringDoctor: study?.referringDoctor ? '[REDACTED]' : null,
      results: results.map((result: any) => ({
        type: String(result?.type || ''),
        data: anonymizeNode(result?.data || {}, tokenMap),
      })),
    };
  });

  return {
    patient: {
      id: String(patient?.id || ''),
      label: 'Patient_A',
      ageYears: calculateAgeYears(patient?.personalData?.birthDate),
      gender: patient?.personalData?.gender || undefined,
    },
    timelineStartDate,
    encounters: normalizedEncounters,
    studies: normalizedStudies,
  };
}
