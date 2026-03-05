import fs from 'fs';
import path from 'path';
import app from '../src/app';
import { getMedicalDocuments, initRecetarioClient } from '../src/services/recetario/recetario-client';
import type { MedicalDocument } from '../src/services/recetario/recetario-client';
import { reverseMapGender } from '../src/services/recetario/data-mapper';

const ORG_SLUG = 'hematologia-herrera';
const HEALTH_CENTER_ID = 7;
const JUANCA_ID = '540dc81947771d1f3f8b4567';
const DRY_RUN = process.argv.includes('--dry-run');
const FRESH = process.argv.includes('--fresh');
const REFETCH = process.argv.includes('--refetch');
const NO_FETCH = process.argv.includes('--no-fetch');
const WAITTIME = 2000;

const DATA_FILE = path.join(__dirname, 'import-recetario-data.json');
const RESUME_FILE = path.join(__dirname, 'import-recetario-resume.json');

// ---- Data cache (raw API docs) ----

function loadDataCache(): MedicalDocument[] | null {
  if (!fs.existsSync(DATA_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

async function fetchAllDocs(): Promise<MedicalDocument[]> {
  const all: MedicalDocument[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    console.log(`  Fetching page ${page}/${totalPages}...`);
    const response = await getMedicalDocuments({ healthCenterId: HEALTH_CENTER_ID, page });
    totalPages = response.meta.totalPages;
    all.push(...response.data);
    page++;
    if (page <= totalPages) {
      await new Promise(resolve => setTimeout(resolve, WAITTIME));
    }
  } while (page <= totalPages);

  return all;
}

// ---- Resume state ----

interface SkippedItem {
  docId: number;
  type: string;
  reason: string;
  patientInfo?: string;
}

interface ResumeState {
  processedIndex: number;
  imported: number;
  createdPatients: number;
  skippedDuplicate: number;
  skipped: SkippedItem[];
}

function loadResumeState(): ResumeState | null {
  if (FRESH) {
    if (fs.existsSync(RESUME_FILE)) fs.unlinkSync(RESUME_FILE);
    return null;
  }
  if (!fs.existsSync(RESUME_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(RESUME_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveResumeState(state: ResumeState): void {
  fs.writeFileSync(RESUME_FILE, JSON.stringify(state, null, 2));
}

// ---- Patient helpers ----

async function buildPatientMap(orgId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const orgPatients = await app.service('organization-patients' as any).find({
    query: { organizationId: orgId },
    paginate: false,
  } as any);
  const patientIds = (Array.isArray(orgPatients) ? orgPatients : []).map((op: any) => op.patientId);

  for (const patientId of patientIds) {
    try {
      const patient = await app.service('patients').get(patientId, { provider: undefined } as any);
      const personalData = (patient as any).personalData || {};
      const docValue = personalData.documentValue?.replace(/\D/g, '');
      if (docValue) {
        map.set(docValue, patientId);
      }
    } catch {
      // skip patient
    }
  }

  return map;
}

function matchPatient(doc: MedicalDocument, patientMap: Map<string, string>): string | null {
  if (!doc.patient?.documentNumber) return null;
  const normalized = doc.patient.documentNumber.replace(/\D/g, '');
  return patientMap.get(normalized) || null;
}

async function createPatientFromDoc(doc: MedicalDocument, orgId: string): Promise<string> {
  const prepagaId = doc.patient.healthInsurance ? await lookupPrepagaId(doc.patient.healthInsurance) : null;
  const patient = await app.service('patients').create(
    {
      personalData: {
        firstName: doc.patient.name,
        lastName: doc.patient.surname,
        documentType: 'DNI',
        documentValue: doc.patient.documentNumber.replace(/\D/g, ''),
        nationality: 'AR',
        ...(doc.patient.gender && { gender: reverseMapGender(doc.patient.gender) }),
        ...(doc.patient.birthDate && { birthDate: doc.patient.birthDate }),
      },
      contactData: {
        ...(doc.patient.email && { email: doc.patient.email }),
        ...(doc.patient.phone && { phoneNumber: doc.patient.phone.replace(/^tel:/i, '') }),
      },
      ...(prepagaId && { medicareId: prepagaId }),
      ...(doc.patient.insuranceNumber && { medicareNumber: doc.patient.insuranceNumber }),
    } as any,
    { provider: undefined, organizationId: orgId } as any
  );
  return (patient as any).id;
}

async function updatePatientFromDoc(doc: MedicalDocument, patientId: string): Promise<void> {
  try {
    const patch: Record<string, any> = {};

    const personalData: Record<string, any> = {};
    if (doc.patient.gender) personalData.gender = reverseMapGender(doc.patient.gender);
    if (doc.patient.birthDate) personalData.birthDate = doc.patient.birthDate;
    if (Object.keys(personalData).length > 0) patch.personalData = personalData;

    const contactData: Record<string, any> = {};
    if (doc.patient.email) contactData.email = doc.patient.email;
    if (doc.patient.phone) contactData.phoneNumber = doc.patient.phone.replace(/^tel:/i, '');
    if (Object.keys(contactData).length > 0) patch.contactData = contactData;

    if (doc.patient.insuranceNumber) patch.medicareNumber = doc.patient.insuranceNumber;
    if (doc.patient.healthInsurance) {
      const prepagaId = await lookupPrepagaId(doc.patient.healthInsurance);
      if (prepagaId) patch.medicareId = prepagaId;
    }

    if (Object.keys(patch).length > 0) {
      await app.service('patients').patch(patientId, patch as any, { provider: undefined } as any);
    }
  } catch {
    // non-fatal
  }
}

const prepagaCache = new Map<string, string | null>();

async function lookupPrepagaId(healthInsurance: string): Promise<string | null> {
  if (prepagaCache.has(healthInsurance)) return prepagaCache.get(healthInsurance)!;
  try {
    const results = await app.service('prepagas' as any).find({
      query: { $search: healthInsurance, $limit: 1 },
      paginate: false,
      provider: undefined,
    } as any);
    const id = Array.isArray(results) && results.length > 0 ? String(results[0].id) : null;
    prepagaCache.set(healthInsurance, id);
    return id;
  } catch {
    return null;
  }
}

const medicationCache = new Map<string, string | null>();

async function lookupMedicationId(text: string): Promise<string | null> {
  if (medicationCache.has(text)) return medicationCache.get(text)!;
  try {
    const results = await app.service('medications').find({
      query: { $search: text, $limit: 1 },
      paginate: false,
      provider: undefined,
    } as any);
    const id = Array.isArray(results) && results.length > 0 ? String(results[0].id) : null;
    medicationCache.set(text, id);
    return id;
  } catch {
    return null;
  }
}

async function existingPrescriptionRef(reference: string): Promise<boolean> {
  const result = await app.service('prescriptions').find({
    query: { recetarioReference: reference, $limit: 1 },
    paginate: false,
    provider: undefined,
  } as any);
  return Array.isArray(result) && result.length > 0;
}

// ---- Main ----

(async () => {
  try {
    console.log(DRY_RUN ? '[DRY RUN] No records will be created.\n' : '');

    initRecetarioClient(app);

    // --- Phase 1: get all docs (from cache or API) ---
    let docs: MedicalDocument[];
    const cached = !REFETCH && loadDataCache();

    if (cached) {
      docs = cached;
      console.log(`Loaded ${docs.length} documents from local cache (${DATA_FILE})\n`);
    } else if (NO_FETCH) {
      console.warn(`Warning: --no-fetch specified but no data cache found at ${DATA_FILE}. Nothing to import.\n`);
      docs = [];
    } else {
      console.log('Fetching all documents from Recetario API...');
      docs = await fetchAllDocs();
      fs.writeFileSync(DATA_FILE, JSON.stringify(docs, null, 2));
      console.log(`Fetched ${docs.length} documents and saved to ${DATA_FILE}\n`);
    }

    // --- Phase 2: import into DB ---

    const orgs = await app.service('organizations').find({
      query: { slug: ORG_SLUG, $limit: 1 },
      paginate: false,
      provider: undefined,
    } as any);
    const org = Array.isArray(orgs) ? orgs[0] : null;
    if (!org) {
      console.error(`Organization with slug "${ORG_SLUG}" not found.`);
      process.exit(1);
    }
    const orgId = org.id.toString();
    console.log(`Organization: ${org.name} (${orgId})`);

    console.log('Building patient lookup map...');
    const patientMap = await buildPatientMap(orgId);
    console.log(`  Found ${patientMap.size} patient keys\n`);

    const resume = loadResumeState();
    const startIndex = resume ? resume.processedIndex + 1 : 0;
    let imported = resume ? resume.imported : 0;
    let createdPatients = resume ? resume.createdPatients : 0;
    let skippedDuplicate = resume ? resume.skippedDuplicate : 0;
    const skipped: SkippedItem[] = resume ? resume.skipped : [];

    if (resume) {
      console.log(`Resuming from document ${startIndex + 1}/${docs.length} (${resume.imported} already imported)\n`);
    }

    for (let i = startIndex; i < docs.length; i++) {
      const doc = docs[i];

      if (i % 50 === 0) {
        console.log(`Processing ${i + 1}/${docs.length}...`);
      }

      const reference = doc.reference || `recetario-import-${doc.id}`;

      if (await existingPrescriptionRef(reference)) {
        skippedDuplicate++;
      } else {
        let patientId = matchPatient(doc, patientMap);

        if (!patientId) {
          if (!doc.patient?.documentNumber) {
            skipped.push({
              docId: doc.id,
              type: doc.type,
              reason: 'No patient document number',
              patientInfo: `${doc.patient?.name} ${doc.patient?.surname}`,
            });
          } else if (!DRY_RUN) {
            patientId = await createPatientFromDoc(doc, orgId);
            const normalized = doc.patient.documentNumber.replace(/\D/g, '');
            patientMap.set(normalized, patientId);
            createdPatients++;
            console.log(`    Created patient: ${doc.patient.name} ${doc.patient.surname} (${normalized})`);
          } else {
            console.log(`    [DRY RUN] Would create patient: ${doc.patient.name} ${doc.patient.surname} (${doc.patient.documentNumber})`);
            createdPatients++;
          }
        }

        if (patientId) {
          if (!DRY_RUN) {
            await updatePatientFromDoc(doc, patientId);
            await app.service('prescriptions').create(
              {
                organizationId: orgId,
                medicId: JUANCA_ID,
                patientId,
                recetarioReference: reference,
                recetarioDocumentIds: [{ id: doc.id, type: doc.type, url: doc.url }],
                type: doc.type === 'order' ? 'order' : 'prescription',
                status: 'completed',
                content: {
                  ...(doc.diagnosis ? { diagnosis: doc.diagnosis } : {}),
                  ...(doc.medicines?.length ? {
                    medicines: await Promise.all(doc.medicines.map(async m => {
                      const medicationId = await lookupMedicationId(m.text);
                      return { text: m.text, quantity: m.quantity, posology: m.posology, longTerm: m.longTerm, genericOnly: m.genericOnly, ...(medicationId ? { medicationId } : {}) };
                    })),
                  } : {}),
                  ...(doc.medicine ? { orderText: doc.medicine } : {}),
                },
                createdAt: doc.date || doc.createdDate,
                updatedAt: doc.date || doc.createdDate,
              } as any,
              { provider: undefined } as any
            );
          }
          imported++;
        }
      }

      // Save resume state every 10 docs
      if (i % 10 === 0) {
        saveResumeState({ processedIndex: i, imported, createdPatients, skippedDuplicate, skipped });
      }
    }

    if (fs.existsSync(RESUME_FILE)) fs.unlinkSync(RESUME_FILE);

    console.log('\n=== Summary ===');
    console.log(`Total imported: ${imported}`);
    console.log(`Patients created: ${createdPatients}`);
    console.log(`Skipped (duplicate): ${skippedDuplicate}`);
    console.log(`Skipped (no doc number): ${skipped.length}`);

    if (skipped.length > 0) {
      console.log('\n--- Skipped details ---');
      for (const item of skipped) {
        console.log(`  [${item.docId}] ${item.type} - ${item.reason}`);
        console.log(`    Patient: ${item.patientInfo}`);
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('Import failed:', error.message || error);
    process.exit(1);
  }
})();
