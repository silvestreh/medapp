/**
 * Staging seed script — seeds the staging database with Faker data instead of
 * data dumps.
 *
 * It imports the API app (src/app), so every create goes through the real
 * feathers services and their hooks (password hashing, personal/contact data
 * encryption, encounter hash chain, system practices, etc.), which gives us a
 * database state the API and web app can actually work with.
 *
 * Config: running with NODE_ENV=staging makes node-config layer
 * config/staging.json on top of config/default.json. staging.json sets
 * `postgres` to "STAGING_DB_URL", which @feathersjs/configuration substitutes
 * with the STAGING_DB_URL value from the API's .env file.
 *
 * Usage (from apps/api, meant to be run locally — not in CI):
 *   npm run db:seed-staging
 *
 * Pass --reset to DROP the staging schema (all data!) and reseed from scratch.
 * It asks for interactive confirmation before dropping anything.
 *
 * Seeding order matters:
 *   1. Schema sync + extensions (pgcrypto is required by encrypted fields)
 *   2. Reference data: roles → ICD-10 → laboratories/medications → prepagas
 *   3. Organization
 *   4. Users (+ organization-users, user-roles, md-settings) — roles must exist
 *   5. System practices (auto-created on first find) + practice-codes — need
 *      users and prepagas
 *   6. Patients (+ organization-patients)
 *   7. Encounters, studies + study-results, appointments — need medics and
 *      patients
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline/promises';
import pLimit from 'p-limit';
import { omit } from 'lodash';
import { faker } from '@faker-js/faker/locale/es_MX';
import { Sequelize } from 'sequelize';
import app from '../src/app';

const SEEDS_DIR = path.join(__dirname, './seeds');

const ORG_NAME = 'Consultorio Demo (Staging)';
const ORG_SLUG = 'staging-demo';

// Meets the password policy: 8+ chars, upper, lower, digit, special.
const PASSWORD = process.env.SEED_STAGING_PASSWORD || 'Staging4u!';

const PATIENT_COUNT = 150;

// Every patient gets a ~1-year medical history (to showcase date sorting in
// the encounter browser) and at least one appointment.
const HISTORY_MONTHS = 12;
const ENCOUNTERS_PER_MONTH = { min: 1, max: 2 };
const STUDIES_PER_MONTH = { min: 0, max: 2 };
const APPOINTMENT_MONTHS = 3;

// ~70% of patients get a SIRE (anticoagulation) treatment with a dose
// schedule and INR readings, so the feature can be demoed.
const SIRE_TREATMENT_RATIO = 0.7;

// A few encounters get deliberately modified AFTER their hash was computed,
// so the integrity check fails on them — controlled demo data for the
// tamper-detection feature. They are listed explicitly in the summary.
const TAMPERED_ENCOUNTER_COUNT = 3;

// Concurrency for independent creates. Encounters are parallel across
// patients but sequential per patient — each patient's hash chain must be
// appended in date order.
const CONCURRENCY = 10;

const RESET = process.argv.includes('--reset');

// ── safety guards ────────────────────────────────────────────────────────────
// app.ts already ran dotenv.config() on import, so .env values are available.

if (process.env.NODE_ENV !== 'staging') {
  console.error('Refusing to run: NODE_ENV must be "staging" (use `npm run db:seed-staging`).');
  process.exit(1);
}

if (!process.env.STAGING_DB_URL) {
  console.error('Refusing to run: STAGING_DB_URL is not set in apps/api/.env.');
  process.exit(1);
}

if (app.get('postgres') !== process.env.STAGING_DB_URL) {
  console.error('Refusing to run: the app is not using STAGING_DB_URL (staging.json was not picked up?).');
  process.exit(1);
}

// src/sequelize.ts fires a floating "CREATE DATABASE" query against the
// server's `postgres` database on import. On managed Postgres (Railway, Neon,
// …) that connection can be refused, which would crash the script via an
// unhandled rejection. Log it and keep seeding instead.
process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled rejection (ignored):', (reason as any)?.message || reason);
});

// ── helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDni(): string {
  return String(faker.number.int({ min: 10_000_000, max: 99_999_999 }));
}

function randomNum(min: number, max: number, decimals = 1): string {
  return faker.number.float({ min, max, fractionDigits: decimals }).toString();
}

async function serviceTotal(serviceName: string): Promise<number> {
  const result = (await app.service(serviceName as any).find({
    query: { $limit: 0 },
  } as any)) as any;
  return typeof result.total === 'number' ? result.total : (result as any[]).length;
}

async function loadSeed<T>(filename: string): Promise<T> {
  const content = await fs.readFile(path.join(SEEDS_DIR, filename), 'utf-8');
  return JSON.parse(content) as T;
}

function toStartCase(s: string): string {
  if (!s || !s.trim()) return s;
  return s
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length > 1 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

const STUDY_TYPES = [
  'anemia', 'anticoagulation', 'compatibility', 'hemostasis', 'myelogram', 'thrombophilia',
];

// Faker has no es_AR locale (es_MX is the closest), so locations, addresses,
// and phone numbers come from curated Argentine data instead. The whole seed
// lives in ONE city (picked per run) — a clinic's users and patients share it,
// and phone numbers carry that city's area code.
const AR_LOCATIONS = [
  { city: 'La Plata', province: 'Buenos Aires', areaCode: '221' },
  { city: 'Mar del Plata', province: 'Buenos Aires', areaCode: '223' },
  { city: 'CABA', province: 'CABA', areaCode: '11' },
  { city: 'Córdoba', province: 'Córdoba', areaCode: '351' },
  { city: 'Rosario', province: 'Santa Fe', areaCode: '341' },
  { city: 'Mendoza', province: 'Mendoza', areaCode: '261' },
  { city: 'San Miguel de Tucumán', province: 'Tucumán', areaCode: '381' },
];

const SEED_LOCATION = AR_LOCATIONS[Math.floor(Math.random() * AR_LOCATIONS.length)];

const AR_STREETS = [
  'San Martín', 'Belgrano', 'Mitre', 'Rivadavia', 'Sarmiento', 'Urquiza',
  'Av. Corrientes', 'Av. Santa Fe', '9 de Julio', 'Moreno', 'Alsina', 'Lavalle',
];

// Self-contained logo (data URI): the seed runs locally, so it can't drop a
// file into the staging server's uploads dir. The UI's CSP allows data: images.
const ORG_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">'
  + '<rect width="128" height="128" rx="24" fill="#4dabf7"/>'
  + '<text x="64" y="82" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#fff" text-anchor="middle">CD</text>'
  + '</svg>';
const ORG_LOGO_URL = `data:image/svg+xml;base64,${Buffer.from(ORG_LOGO_SVG).toString('base64')}`;

function randomArAddress(): string {
  return `${pickRandom(AR_STREETS)} ${faker.number.int({ min: 100, max: 5000 })}`;
}

function randomArPhone(): string {
  return `${SEED_LOCATION.areaCode} ${faker.number.int({ min: 2000, max: 7999 })}-${faker.number.int({ min: 1000, max: 9999 })}`;
}

// Random date within the calendar month `monthsAgo` months back (capped at now).
function randomDateInMonth(monthsAgo: number): Date {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - monthsAgo);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const now = new Date();

  return faker.date.between({ from: start, to: end > now ? now : end });
}

const MEDICAL_SPECIALTIES = [
  'Clínica Médica',
  'Cardiología',
  'Hematología',
  'Pediatría',
  'Traumatología',
];

const CONSULTATION_REASONS = [
  'Control de rutina',
  'Dolor torácico',
  'Cefalea recurrente',
  'Dolor abdominal',
  'Fiebre persistente',
  'Tos crónica',
  'Mareos y vértigo',
  'Control post-quirúrgico',
  'Dolor lumbar',
  'Hipertensión arterial',
  'Fatiga crónica',
  'Erupción cutánea',
  'Control de diabetes',
  'Dificultad respiratoria',
  'Dolor articular',
];

const EVOLUTION_NOTES = [
  'Paciente evoluciona favorablemente. Se mantiene esquema terapéutico actual.',
  'Se ajusta medicación por hipertensión. Control en 15 días.',
  'Sin cambios significativos. Se solicitan estudios complementarios.',
  'Mejoría clínica notable. Se reduce dosis de analgésicos.',
  'Paciente refiere persistencia de síntomas. Se deriva a especialista.',
  'Examen físico sin particularidades. Se continúa con plan actual.',
  'Se indica reposo relativo y antiinflamatorios. Control en una semana.',
  'Resultados de laboratorio dentro de parámetros normales. Alta médica.',
];

const REASON_DETAILS = [
  'Refiere dolor de intensidad moderada desde hace una semana.',
  'Síntomas de inicio insidioso, sin fiebre asociada.',
  'Empeora con el esfuerzo físico y mejora con el reposo.',
  'Sin respuesta a la medicación habitual.',
  'Asociado a náuseas y pérdida de apetito.',
  'Episodios intermitentes durante el último mes.',
  'Interfiere con el sueño y las actividades diarias.',
  'Antecedente de un cuadro similar el año pasado.',
];

const MICROSCOPY_NOTES = [
  'Médula ósea normocelular para la edad. Relación mieloeritroide conservada. Megacariocitos presentes en número y morfología normales.',
  'Celularidad levemente aumentada. Se observan las tres series hematopoyéticas con maduración conservada.',
  'Extendidos con adecuada celularidad. Sin evidencia de infiltración por células atípicas.',
  'Médula ósea hipocelular. Predominio de tejido adiposo. Se sugiere correlación clínica.',
];

const MYELOPOIETIC_NOTES = [
  'Serie mieloide con maduración completa y conservada.',
  'Hiperplasia leve de la serie granulocítica, sin desviación a la izquierda.',
  'Serie mieloide dentro de límites normales.',
];

const ERYTHROPOIETIC_NOTES = [
  'Serie eritroide normoblástica, con maduración conservada.',
  'Hiperplasia eritroide leve, compatible con regeneración medular.',
  'Serie eritroide sin alteraciones morfológicas significativas.',
];

const PERSONAL_HISTORY = [
  'Hipertensión arterial',
  'Diabetes mellitus tipo 2',
  'Asma bronquial',
  'Hipotiroidismo',
  'Dislipemia',
  'Cirugía de vesícula (2019)',
  'Fractura de muñeca (2021)',
];

function buildEncounterData(): Record<string, any> {
  const data: Record<string, any> = {};

  const reasonCount = faker.number.int({ min: 1, max: 3 });
  const reasonValues: Record<string, string> = {
    consulta_intern_count: String(reasonCount),
  };
  for (let i = 0; i < reasonCount; i++) {
    reasonValues[`motivo_text_${i}`] = pickRandom(CONSULTATION_REASONS);
    reasonValues[`motivo_descripcion_${i}`] = faker.datatype.boolean(0.4)
      ? pickRandom(REASON_DETAILS)
      : '';
  }
  data['general/consulta_internacion'] = {
    type: 'general/consulta_internacion',
    values: reasonValues,
  };

  if (faker.datatype.boolean(0.6)) {
    data['general/evolucion_consulta_internacion'] = {
      type: 'general/evolucion_consulta_internacion',
      values: { evo_descripcion: pickRandom(EVOLUTION_NOTES) },
    };
  }

  if (faker.datatype.boolean(0.3)) {
    const historyCount = faker.number.int({ min: 1, max: 2 });
    const histValues: Record<string, string> = {
      antecedente_count: String(historyCount),
    };
    for (let i = 0; i < historyCount; i++) {
      histValues[`antecedente_${i}`] = pickRandom(PERSONAL_HISTORY);
      histValues[`fecha_antecedente_${i}`] = faker.date
        .past({ years: 10 })
        .toLocaleDateString('es-AR');
      histValues[`antecedente_descripcion_${i}`] = '';
    }
    data['antecedentes/personales'] = {
      type: 'antecedentes/personales',
      values: histValues,
    };
  }

  return data;
}

function buildStudyResult(studyType: string): { type: string; data: string } {
  const d: Record<string, string | { value: string; label: string }> = {};

  switch (studyType) {
  case 'anemia':
    d.rbc = randomNum(3.5, 6.5);
    d.hematocrit = randomNum(33, 52);
    d.hemoglobin = randomNum(10, 17);
    d.reticulocytes = randomNum(0.1, 2);
    d.vcm = randomNum(75, 100);
    d.hcm = randomNum(25, 35);
    d.chcm = randomNum(30, 37);
    d.rdw_sd = randomNum(37, 50);
    d.rdw_cv = randomNum(11, 16);
    d.serum_iron = randomNum(30, 170, 0);
    d.tibc_transferrin = randomNum(200, 500, 0);
    d.transferrin_saturation = randomNum(15, 55);
    d.leukocytes = randomNum(3.5, 11);
    d.ESR = randomNum(2, 30, 0);
    d.platelets = randomNum(150, 450, 0);
    d.direct_coombs = pickRandom([
      { value: 'positive', label: 'Positiva' },
      { value: 'negative', label: 'Negativa' },
    ]);
    d.lymphocytes = randomNum(18, 45);
    break;

  case 'anticoagulation':
    d.quick = randomNum(10, 16);
    d.rin = randomNum(0.8, 3.5);
    d.aptt = randomNum(25, 45);
    break;

  case 'compatibility': {
    const bt = () => pickRandom([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'ab', label: 'AB' },
      { value: 'o', label: '0' },
    ]);
    const rh = () => pickRandom([
      { value: 'positive', label: 'Positivo' },
      { value: 'negative', label: 'Negativo' },
    ]);
    d.female_blood_type = bt();
    d.female_rh0_d_factor = rh();
    d.female_indirect_coombs = pickRandom([
      { value: 'positive', label: 'Positiva' },
      { value: 'negative', label: 'Negativa' },
    ]);
    d.male_blood_type = bt();
    d.male_rh0_d_factor = rh();
    d.heterozygosity = randomNum(0, 100, 0);
    d.homozygosity = randomNum(0, 100, 0);
    break;
  }

  case 'hemostasis':
    d.quick = randomNum(10, 16);
    d.prothrombin_concentration = randomNum(65, 130);
    d.rin = randomNum(0.7, 1.5);
    d.aptt = randomNum(26, 44);
    d.ttd = randomNum(9, 15);
    d.fibrinogen = randomNum(1.5, 4.5);
    d.hematocrit = randomNum(33, 52);
    d.hemoglobin = randomNum(10, 17);
    d.yield_platelets = randomNum(150, 450, 0);
    break;

  case 'myelogram':
    d.procedure = 'Punción aspiración de médula ósea en cresta ilíaca posterior.';
    d.microscopy = pickRandom(MICROSCOPY_NOTES);
    d.myelopoietic_series = pickRandom(MYELOPOIETIC_NOTES);
    d.erythropoietic_series = pickRandom(ERYTHROPOIETIC_NOTES);
    break;

  case 'thrombophilia':
    d.quick = randomNum(10, 16);
    d.percentage = randomNum(65, 135);
    d.rin = randomNum(0.7, 1.5);
    d.aptt = randomNum(26, 44);
    break;
  }

  return { type: studyType, data: JSON.stringify(d) };
}

// ── schema ───────────────────────────────────────────────────────────────────

// --reset: drop the whole public schema (ALL staging data) after an explicit
// interactive confirmation, so the seed starts from a truly empty database.
async function maybeResetSchema(sequelize: Sequelize): Promise<void> {
  if (!RESET) return;

  const maskedUrl = String(app.get('postgres')).replace(/\/\/[^@]*@/, '//***@');
  console.log('\n!!! --reset will DROP ALL DATA in:');
  console.log(`!!!   ${maskedUrl}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "reset" to confirm, anything else aborts: ');
  rl.close();

  if (answer.trim() !== 'reset') {
    console.log('Aborted — nothing was dropped.');
    process.exit(1);
  }

  // Kick other connections (e.g. the running staging API) off the database so
  // the schema drop doesn't block on their locks.
  await sequelize.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
  `);

  console.log('Dropping schema...');
  await sequelize.query('DROP SCHEMA public CASCADE');
  await sequelize.query('CREATE SCHEMA public');
  console.log('Schema dropped and recreated.\n');
}

async function syncSchema(): Promise<Sequelize> {
  const sequelize: Sequelize = app.get('sequelizeClient');

  console.log('Connecting to the staging database...');
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await sequelize.authenticate();
      break;
    } catch (error) {
      if (attempt === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  await maybeResetSchema(sequelize);

  // Encrypted fields rely on pgcrypto's PGP_SYM_ENCRYPT; reset-db/init-db
  // normally create this, but the app's own sync doesn't.
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // app.setup() initializes model associations and kicks off
  // sequelize.sync({ alter: true }) plus the search extensions/columns
  // (see src/sequelize.ts). app.listen() would do this, but we don't want
  // to start an HTTP server, cron jobs, or queue workers here.
  (app as any).setup();
  console.log('Syncing schema (sequelize.sync with alter)...');
  await app.get('sequelizeSync');
  console.log('Schema ready.\n');

  return sequelize;
}

// ── reference data ───────────────────────────────────────────────────────────

async function seedRoles(): Promise<void> {
  const roles = await loadSeed<any[]>('roles.json');
  const rolesService = app.service('roles');

  for (const role of roles) {
    try {
      await rolesService.create(role);
      console.log(`  Created role: ${role.id}`);
    } catch (error: any) {
      if (error.name === 'Conflict' || error.name === 'SequelizeUniqueConstraintError') {
        console.log(`  Role ${role.id} already exists`);
      } else {
        throw error;
      }
    }
  }
}

async function seedIcd10(): Promise<void> {
  const existing = await serviceTotal('icd-10');
  if (existing > 0) {
    console.log(`  ICD-10 already seeded (${existing} entries), skipping.`);
    return;
  }

  const icd10Raw = await loadSeed<any[]>('icd10-es.json');
  const icd10Service = app.service('icd-10');
  const chunkSize = 500;

  for (let i = 0; i < icd10Raw.length; i += chunkSize) {
    const chunk = icd10Raw.slice(i, i + chunkSize).map((item) => omit(item, 'level'));
    await icd10Service.create(chunk as any);
    if (i % 5000 === 0) console.log(`  ICD-10: ${i} / ${icd10Raw.length}`);
  }
  console.log(`  Seeded ${icd10Raw.length} ICD-10 entries.`);
}

async function seedMedications(): Promise<void> {
  const existing = await serviceTotal('medications');
  if (existing > 0) {
    console.log(`  Medications already seeded (${existing} entries), skipping.`);
    return;
  }

  const medsRaw = await loadSeed<any[]>('medications.json');
  const laboratoriesService = app.service('laboratories');
  const medicationsService = app.service('medications');

  const uniqueLabNames = Array.from(
    new Set(medsRaw.map((r) => r.Laboratorio?.trim()).filter(Boolean)),
  ) as string[];

  const labMap = new Map<string, string>();
  for (const labName of uniqueLabNames) {
    try {
      const lab = (await laboratoriesService.create({ name: labName } as any)) as any;
      labMap.set(labName, lab.id);
    } catch {
      const found = (await laboratoriesService.find({
        query: { name: labName, $limit: 1 },
        paginate: false,
      } as any)) as any[];
      if (found.length > 0) labMap.set(labName, found[0].id);
    }
  }
  console.log(`  Seeded ${labMap.size} laboratories.`);

  const medicationsData = medsRaw
    .filter((r) => r.Nombre_Comercial_Presentacion && r.Monodroga_Generico)
    .map((r) => ({
      commercialNamePresentation: r.Nombre_Comercial_Presentacion,
      genericDrug: r.Monodroga_Generico,
      laboratoryId: labMap.get(r.Laboratorio?.trim()),
      pharmaceuticalForm: r.Forma_Farmaceutica,
      certificateNumber: r.Numero_Certificado,
      gtin: r.GTIN,
      availability: r.Disponibilidad,
    }));

  const chunkSize = 500;
  for (let i = 0; i < medicationsData.length; i += chunkSize) {
    await medicationsService.create(medicationsData.slice(i, i + chunkSize) as any);
    if (i % 5000 === 0) console.log(`  Medications: ${i} / ${medicationsData.length}`);
  }
  console.log(`  Seeded ${medicationsData.length} medications.`);
}

async function seedPrepagas(): Promise<void> {
  const existing = await serviceTotal('prepagas');
  if (existing > 0) {
    console.log(`  Prepagas already seeded (${existing} entries), skipping.`);
    return;
  }

  const prepagasRaw = await loadSeed<any[]>('prepagas-from-cuadros.json');

  // Drop duplicate tier codes within each prepaga (same cleanup as import-seeds).
  for (const prepaga of prepagasRaw) {
    const seenCodes = new Set<number>();
    prepaga.tiers = (prepaga.tiers || []).filter((tier: any) => {
      if (tier.code == null) return true;
      if (seenCodes.has(tier.code)) return false;
      seenCodes.add(tier.code);
      return true;
    });
  }

  const prepagasService = app.service('prepagas');
  const chunkSize = 500;
  for (let i = 0; i < prepagasRaw.length; i += chunkSize) {
    const chunk = prepagasRaw.slice(i, i + chunkSize).map((p: any) => ({
      ...p,
      denomination: toStartCase(p.denomination ?? ''),
    }));
    await prepagasService.create(chunk as any);
  }
  console.log(`  Seeded ${prepagasRaw.length} prepagas.`);
}

// ── organization data ────────────────────────────────────────────────────────

// Real prepagas (seeded above) used consistently for patients' insurance,
// practice codes, and accounting prices — patients need a valid `medicareId`
// for the UI to resolve the insurer and for setCost to price their practices.
async function pickInsurers(): Promise<any[]> {
  const preferred = (await app.service('prepagas').find({
    query: {
      shortName: { $in: ['OSDE', 'SWISS MEDICAL', 'GALENO', 'MEDICUS'] },
      $limit: 4,
    },
    paginate: false,
  } as any)) as any[];

  if (preferred.length > 0) return preferred;

  return (await app.service('prepagas').find({
    query: { $limit: 4 },
    paginate: false,
  } as any)) as any[];
}

function buildInsurerPricing(): Record<string, number> {
  const pricing: Record<string, number> = {
    encounter: faker.number.int({ min: 30, max: 80 }) * 500,
  };
  for (const studyType of STUDY_TYPES) {
    pricing[studyType] = faker.number.int({ min: 40, max: 180 }) * 500;
  }
  return pricing;
}

// The setCost hook prices each created study/encounter from the medic's
// accounting-settings, so these must exist before encounters/studies are
// seeded — otherwise everything lands in accounting at $0.
async function seedAccountingSettings(
  organizationId: string,
  medicIds: string[],
  insurers: any[],
): Promise<void> {
  for (const medicId of medicIds) {
    const insurerPrices: Record<string, Record<string, number>> = {
      _particular: buildInsurerPricing(),
    };
    for (const insurer of insurers) {
      insurerPrices[insurer.id] = buildInsurerPricing();
    }

    await app.service('accounting-settings').create({
      organizationId,
      userId: medicId,
      insurerPrices,
    } as any);
  }
}

interface SeededUsers {
  userIds: string[];
  medicIds: string[];
  credentials: Array<{ username: string; roles: string }>;
}

async function seedUsers(organizationId: string): Promise<SeededUsers> {
  const usersService = app.service('users');
  const orgUsersService = app.service('organization-users');
  const mdSettingsService = app.service('md-settings');

  const userSpecs: Array<{ username: string; roleIds: string[]; sex: 'male' | 'female' }> = [
    { username: 'admin.staging', roleIds: ['owner', 'admin'], sex: 'male' },
    { username: 'dr.staging', roleIds: ['medic'], sex: 'male' },
    { username: 'dra.staging', roleIds: ['medic'], sex: 'female' },
    { username: 'recep.staging', roleIds: ['receptionist'], sex: 'female' },
    { username: 'lab.staging', roleIds: ['lab-tech'], sex: 'female' },
  ];

  const userIds: string[] = [];
  const medicIds: string[] = [];
  const credentials: SeededUsers['credentials'] = [];

  for (const spec of userSpecs) {
    const firstName = faker.person.firstName(spec.sex);
    const lastName = faker.person.lastName();
    const { city, province } = SEED_LOCATION;

    const user = (await usersService.create({
      username: spec.username,
      password: PASSWORD,
      personalData: {
        firstName,
        lastName,
        gender: spec.sex,
        documentType: 'DNI',
        documentValue: randomDni(),
        nationality: 'AR',
      },
      contactData: {
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phoneNumber: [`cel:${randomArPhone()}`],
        city,
        province,
      },
    } as any)) as any;

    userIds.push(user.id);
    credentials.push({ username: spec.username, roles: spec.roleIds.join(', ') });

    await orgUsersService.create({ organizationId, userId: user.id } as any);

    for (const roleId of spec.roleIds) {
      await app.service('user-roles').create({
        userId: user.id,
        roleId,
        organizationId,
      } as any);
    }

    if (spec.roleIds.includes('medic')) {
      medicIds.push(user.id);
      await mdSettingsService.create({
        userId: user.id,
        organizationId,
        medicalSpecialty: pickRandom(MEDICAL_SPECIALTIES),
        nationalLicenseNumber: String(faker.number.int({ min: 10000, max: 99999 })),
        stateLicense: pickRandom(['BA', 'CB', 'MZ', 'SF']),
        stateLicenseNumber: String(faker.number.int({ min: 100, max: 9999 })),
        isVerified: true,
        licenseExpirationDate: faker.date.soon({ days: 365 * 2 }),
        scheduleAllWeekCustomTime: false,
        mondayStart: '08:00:00',
        mondayEnd: '12:00:00',
        tuesdayStart: '08:00:00',
        tuesdayEnd: '12:00:00',
        wednesdayStart: '08:00:00',
        wednesdayEnd: '12:00:00',
        thursdayStart: '08:00:00',
        thursdayEnd: '12:00:00',
        fridayStart: '08:00:00',
        fridayEnd: '12:00:00',
        saturdayStart: null,
        saturdayEnd: null,
        sundayStart: null,
        sundayEnd: null,
        encounterDuration: 20,
      } as any);
    }

    console.log(`  ${spec.roleIds.join(',').padEnd(18)} ${spec.username} (${firstName} ${lastName})`);
  }

  return { userIds, medicIds, credentials };
}

async function seedPracticeCodes(
  organizationId: string,
  medicIds: string[],
  insurers: any[],
): Promise<number> {
  // The practices service auto-creates the system practices for an
  // organization the first time they're queried (ensureSystemPractices).
  const practices = (await app.service('practices').find({
    query: { organizationId },
    organizationId,
    paginate: false,
  } as any)) as any[];

  const systemPractices = practices.filter((p) => p.systemKey);
  console.log(`  System practices for org: ${systemPractices.length}`);

  let created = 0;
  for (const medicId of medicIds) {
    for (const practice of systemPractices) {
      for (const insurer of insurers) {
        try {
          await app.service('practice-codes').create({
            practiceId: practice.id,
            userId: medicId,
            insurerId: insurer.id,
            code: String(faker.number.int({ min: 100000, max: 999999 })),
          } as any);
          created++;
        } catch (error: any) {
          console.warn(`  practice-code failed (${practice.systemKey}/${insurer.shortName}): ${error.message}`);
        }
      }
    }
  }

  return created;
}

async function seedPatients(organizationId: string, insurers: any[]): Promise<string[]> {
  const patientsService = app.service('patients');
  const orgPatientsService = app.service('organization-patients');
  const patientIds: string[] = [];
  const limit = pLimit(CONCURRENCY);
  let done = 0;

  await Promise.all([...Array(PATIENT_COUNT)].map(() => limit(async () => {
    const sex: 'male' | 'female' = faker.datatype.boolean() ? 'male' : 'female';
    const firstName = faker.person.firstName(sex);
    const lastName = faker.person.lastName();
    const { city, province } = SEED_LOCATION;

    // ~70% carry a real insurer (valid medicareId); the rest are "particular".
    const insurer = faker.datatype.boolean(0.7) && insurers.length > 0
      ? pickRandom(insurers)
      : null;
    const tierName = insurer && insurer.tiers?.length > 0 && faker.datatype.boolean(0.6)
      ? pickRandom(insurer.tiers as any[]).name
      : '';

    const patient = (await patientsService.create({
      medicare: insurer ? insurer.shortName : '',
      medicareId: insurer ? insurer.id : null,
      medicareNumber: insurer
        ? String(faker.number.int({ min: 100000, max: 999999 }))
        : '',
      medicarePlan: tierName || '',
      deleted: false,
      personalData: {
        firstName,
        lastName,
        gender: sex,
        documentType: 'DNI',
        documentValue: randomDni(),
        nationality: 'AR',
        birthDate: faker.date.birthdate({ min: 1, max: 90, mode: 'age' }).toISOString(),
        maritalStatus: pickRandom(['single', 'married', 'divorced', 'widowed', null]),
      },
      contactData: {
        email: faker.datatype.boolean(0.6)
          ? faker.internet.email({ firstName, lastName }).toLowerCase()
          : '',
        phoneNumber: [`cel:${randomArPhone()}`],
        streetAddress: randomArAddress(),
        city,
        province,
      },
    } as any)) as any;

    patientIds.push(patient.id);
    await orgPatientsService.create({ organizationId, patientId: patient.id } as any);

    done++;
    if (done % 50 === 0) console.log(`  Patients: ${done} / ${PATIENT_COUNT}`);
  })));

  return patientIds;
}

async function seedEncounters(
  organizationId: string,
  medicIds: string[],
  patientIds: string[],
): Promise<number> {
  const encountersService = app.service('encounters');
  const limit = pLimit(CONCURRENCY);
  let ok = 0;
  let processed = 0;

  // Parallel across patients, sequential per patient. compute-encounter-hash
  // serializes creates per patient with a transaction-level advisory lock
  // (pg_advisory_xact_lock), so concurrent creates are safe — but each
  // patient's chain links every encounter to the latest one by date and
  // verification walks it date-sorted, so a patient's encounters must still
  // be created in ascending date order.
  await Promise.all(patientIds.map((patientId) => limit(async () => {
    const dates: Date[] = [];
    for (let monthsAgo = HISTORY_MONTHS - 1; monthsAgo >= 0; monthsAgo--) {
      const count = faker.number.int(ENCOUNTERS_PER_MONTH);
      for (let i = 0; i < count; i++) {
        dates.push(randomDateInMonth(monthsAgo));
      }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());

    for (const date of dates) {
      try {
        await encountersService.create({
          data: buildEncounterData(),
          date,
          medicId: pickRandom(medicIds),
          patientId,
          organizationId,
        } as any);
        ok++;
      } catch (error: any) {
        console.warn(`  encounter for patient ${patientId} failed: ${error.message}`);
      }
    }

    processed++;
    if (processed % 10 === 0) console.log(`  Encounters: ${processed} / ${patientIds.length} patients (${ok} created)`);
  })));

  return ok;
}

async function seedStudies(
  organizationId: string,
  medicIds: string[],
  patientIds: string[],
): Promise<number> {
  const studiesService = app.service('studies');
  const studyResultsService = app.service('study-results');
  const limit = pLimit(CONCURRENCY);
  let ok = 0;
  let processed = 0;

  await Promise.all(patientIds.map((patientId) => limit(async () => {
    // Same ~1-year spread as encounters — studies share the medical history
    // timeline in the encounter browser. At least one study per patient.
    const dates: Date[] = [];
    for (let monthsAgo = HISTORY_MONTHS - 1; monthsAgo >= 0; monthsAgo--) {
      const count = faker.number.int(STUDIES_PER_MONTH);
      for (let i = 0; i < count; i++) {
        dates.push(randomDateInMonth(monthsAgo));
      }
    }
    if (dates.length === 0) {
      dates.push(randomDateInMonth(faker.number.int({ min: 0, max: HISTORY_MONTHS - 1 })));
    }

    for (const date of dates) {
      const studyTypeCount = faker.number.int({ min: 1, max: 4 });
      const studyTypes = faker.helpers.arrayElements(STUDY_TYPES, studyTypeCount);

      try {
        const study = (await studiesService.create({
          date,
          studies: studyTypes,
          noOrder: faker.datatype.boolean(0.2),
          medicId: pickRandom(medicIds),
          referringDoctor: faker.datatype.boolean(0.4)
            ? `Dr. ${faker.person.lastName()}`
            : null,
          patientId,
          organizationId,
        } as any)) as any;

        for (const studyType of studyTypes) {
          const result = buildStudyResult(studyType);
          await studyResultsService.create({
            studyId: study.id,
            type: result.type,
            data: result.data,
          } as any);
        }

        ok++;
      } catch (error: any) {
        console.warn(`  study for patient ${patientId} failed: ${error.message}`);
      }
    }

    processed++;
    if (processed % 50 === 0) console.log(`  Studies: ${processed} / ${patientIds.length} patients (${ok} created)`);
  })));

  return ok;
}

async function seedAppointments(
  organizationId: string,
  medicIds: string[],
  patientIds: string[],
): Promise<number> {
  const appointmentsService = app.service('appointments');

  // Slots within the medics' md-settings schedule: weekdays 08:00–12:00,
  // 20-minute encounters (12 slots per medic per day), covering the next
  // APPOINTMENT_MONTHS from the seeding date. Each medic-day gets a random
  // 3–8 slots booked; a second pass then assigns a slot to every patient
  // still without an appointment so all of them have one.
  interface Slot { medicId: string; startDate: Date }
  const booked: Array<{ slot: Slot; patientId: string }> = [];
  const freeSlots: Slot[] = [];
  const patientsWithAppointment = new Set<string>();

  const today = new Date();
  const end = new Date(today);
  end.setMonth(end.getMonth() + APPOINTMENT_MONTHS);

  for (let day = new Date(today); day <= end; day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;

    for (const medicId of medicIds) {
      const bookedIndices = faker.helpers.arrayElements(
        [...Array(12).keys()],
        faker.number.int({ min: 3, max: 8 }),
      );

      for (let i = 0; i < 12; i++) {
        const startDate = new Date(day);
        startDate.setHours(8, i * 20, 0, 0);
        const slot = { medicId, startDate };

        if (bookedIndices.includes(i)) {
          const patientId = pickRandom(patientIds);
          booked.push({ slot, patientId });
          patientsWithAppointment.add(patientId);
        } else {
          freeSlots.push(slot);
        }
      }
    }
  }

  // Guarantee every patient has at least one appointment.
  const uncovered = patientIds.filter((id) => !patientsWithAppointment.has(id));
  const shuffledFree = faker.helpers.shuffle(freeSlots);
  for (const patientId of uncovered) {
    const slot = shuffledFree.pop();
    if (!slot) break;
    booked.push({ slot, patientId });
  }

  const limit = pLimit(CONCURRENCY);
  let ok = 0;
  const perMedic = new Map<string, number>();

  await Promise.all(booked.map(({ slot, patientId }) => limit(async () => {
    try {
      await appointmentsService.create({
        organizationId,
        medicId: slot.medicId,
        patientId,
        startDate: slot.startDate,
        extra: false,
      } as any);
      ok++;
      perMedic.set(slot.medicId, (perMedic.get(slot.medicId) || 0) + 1);
      if (ok % 100 === 0) console.log(`  Appointments: ${ok} / ${booked.length}`);
    } catch (error: any) {
      console.warn(`  appointment failed: ${error.message}`);
    }
  })));

  for (const [medicId, count] of perMedic) {
    console.log(`  Medic ${medicId}: ${count} appointments`);
  }

  return ok;
}

const SIRE_INDICATIONS = [
  'Fibrilación auricular',
  'Trombosis venosa profunda',
  'Prótesis valvular mecánica',
  'Tromboembolismo pulmonar',
];

const DOSE_FRACTIONS = [null, 0.25, 0.5, 0.75, 1];

async function seedSireTreatments(
  organizationId: string,
  medicIds: string[],
  patientIds: string[],
): Promise<number> {
  const treatmentsService = app.service('sire-treatments');
  const schedulesService = app.service('sire-dose-schedules');
  const readingsService = app.service('sire-readings');

  const sirePatients = patientIds.filter(() => Math.random() < SIRE_TREATMENT_RATIO);
  const limit = pLimit(CONCURRENCY);
  let ok = 0;

  await Promise.all(sirePatients.map((patientId) => limit(async () => {
    try {
      const medicId = pickRandom(medicIds);
      const isMechanicalValve = faker.datatype.boolean(0.2);
      const startDate = randomDateInMonth(faker.number.int({ min: 4, max: HISTORY_MONTHS - 1 }));

      const treatment = (await treatmentsService.create({
        patientId,
        organizationId,
        medicId,
        medication: pickRandom(['Acenocumarol', 'Warfarina']),
        tabletDoseMg: pickRandom([1, 4]),
        indication: pickRandom(SIRE_INDICATIONS),
        targetInrMin: isMechanicalValve ? 2.5 : 2.0,
        targetInrMax: isMechanicalValve ? 3.5 : 3.0,
        startDate,
        status: pickRandom(['active', 'active', 'active', 'paused', 'completed']),
        nextControlDate: faker.date.soon({ days: 30 }),
        notes: faker.datatype.boolean(0.3) ? 'Control estricto por antecedente de sangrado.' : null,
      } as any)) as any;

      await schedulesService.create({
        treatmentId: treatment.id,
        startDate,
        schedule: {
          monday: pickRandom(DOSE_FRACTIONS),
          tuesday: pickRandom(DOSE_FRACTIONS),
          wednesday: pickRandom(DOSE_FRACTIONS),
          thursday: pickRandom(DOSE_FRACTIONS),
          friday: pickRandom(DOSE_FRACTIONS),
          saturday: pickRandom(DOSE_FRACTIONS),
          sunday: pickRandom(DOSE_FRACTIONS),
        },
        createdById: medicId,
      } as any);

      // INR readings between treatment start and now
      const readingCount = faker.number.int({ min: 4, max: 8 });
      for (let i = 0; i < readingCount; i++) {
        await readingsService.create({
          treatmentId: treatment.id,
          patientId,
          organizationId,
          date: faker.date.between({ from: startDate, to: new Date() }),
          inr: Number(randomNum(1.5, 4.5)),
          quick: Number(randomNum(10, 16)),
          percentage: Number(randomNum(60, 120, 0)),
          source: pickRandom(['provider', 'lab']),
        } as any);
      }

      ok++;
    } catch (error: any) {
      console.warn(`  SIRE treatment for patient ${patientId} failed: ${error.message}`);
    }
  })));

  return ok;
}

// Deliberately modify a few encounters AFTER creation: the stored hash no
// longer matches the data, so the UI's integrity check flags them. This is
// the controlled demo data for tamper detection — the affected encounters
// are printed in the summary and their altered text carries a visible marker.
async function tamperEncountersForDemo(
  patientIds: string[],
): Promise<Array<{ id: string; patientId: string; date: string }>> {
  const encountersService = app.service('encounters');
  const targets = faker.helpers.arrayElements(patientIds, TAMPERED_ENCOUNTER_COUNT);
  const tampered: Array<{ id: string; patientId: string; date: string }> = [];

  for (const patientId of targets) {
    try {
      const found = (await encountersService.find({
        query: { patientId, $limit: 1 },
        paginate: false,
      } as any)) as any[];
      if (found.length === 0) continue;

      const encounter = found[0];
      const data = typeof encounter.data === 'string' ? JSON.parse(encounter.data) : encounter.data;

      const firstKey = Object.keys(data)[0];
      if (!firstKey) continue;
      const values = data[firstKey].values || {};
      const firstValueKey = Object.keys(values)[0];
      if (!firstValueKey) continue;
      values[firstValueKey] = `${values[firstValueKey]} [DATO ALTERADO — demo de integridad]`;

      // Internal patch re-encrypts the data but does NOT recompute the hash
      // (hashes are only computed on create), so the chain check fails.
      await encountersService.patch(encounter.id, { data } as any);
      tampered.push({
        id: encounter.id,
        patientId,
        date: new Date(encounter.date).toISOString(),
      });
    } catch (error: any) {
      console.warn(`  tampering encounter for patient ${patientId} failed: ${error.message}`);
    }
  }

  return tampered;
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== Seed Staging Database ===');
  console.log(`  Database: ${String(app.get('postgres')).replace(/\/\/[^@]*@/, '//***@')}\n`);

  try {
    await syncSchema();

    console.log('Seeding roles...');
    await seedRoles();

    console.log('\nSeeding ICD-10...');
    await seedIcd10();

    console.log('\nSeeding laboratories and medications...');
    await seedMedications();

    console.log('\nSeeding prepagas...');
    await seedPrepagas();

    console.log(`\nCreating organization "${ORG_NAME}"...`);
    const existingOrgs = (await app.service('organizations').find({
      query: { slug: ORG_SLUG, $limit: 1 },
      paginate: false,
    } as any)) as any[];

    if (existingOrgs.length > 0) {
      const organizationId = existingOrgs[0].id;
      console.log(`\nOrganization "${ORG_SLUG}" already exists (${organizationId}).`);

      // Top-up mode: seed features added after the main seed ran, without
      // wiping the (expensive) existing data.
      const sireTotal = await serviceTotal('sire-treatments');
      if (sireTotal > 0) {
        console.log('The staging database looks fully seeded — nothing else to do.');
        console.log('Re-run with --reset to drop everything and reseed from scratch.');
        process.exit(0);
      }

      console.log('Topping up existing data: SIRE treatments + integrity-demo tampering...');

      const medicRoles = (await app.service('user-roles').find({
        query: { organizationId, roleId: 'medic' },
        paginate: false,
      } as any)) as any[];
      const medicIds = medicRoles.map((r) => String(r.userId));

      const orgPatients = (await app.service('organization-patients').find({
        query: { organizationId },
        paginate: false,
      } as any)) as any[];
      const patientIds = orgPatients.map((p) => String(p.patientId));

      console.log(`\nCreating SIRE treatments for ~${Math.round(SIRE_TREATMENT_RATIO * 100)}% of ${patientIds.length} patients...`);
      const sireCount = await seedSireTreatments(organizationId, medicIds, patientIds);
      console.log(`  Created ${sireCount} treatments (with dose schedules and INR readings).`);

      console.log(`\nTampering ${TAMPERED_ENCOUNTER_COUNT} encounters for the integrity demo...`);
      const tampered = await tamperEncountersForDemo(patientIds);
      console.log('\n=== INTENTIONALLY tampered encounters (integrity demo) ===');
      console.log('  These MUST show the red integrity warning in the UI:');
      for (const t of tampered) {
        console.log(`  encounter ${t.id} — patient ${t.patientId} — ${t.date}`);
      }

      console.log('\nDone!');
      process.exit(0);
    }

    // Full healthCenter data so Recetario can be enabled from the staging UI
    // (it requires address, phone, email, and logo). The register-health-center
    // hook only fires on PATCH, so seeding this at create time does NOT call
    // Recetario's API — that happens through the UI when someone enables it.
    const org = (await app.service('organizations').create({
      name: ORG_NAME,
      slug: ORG_SLUG,
      settings: {
        healthCenter: {
          address: `${randomArAddress()}, ${SEED_LOCATION.city}, ${SEED_LOCATION.province}`,
          phone: randomArPhone(),
          email: 'staging-demo@athel.as',
          logoUrl: ORG_LOGO_URL,
        },
      },
      isActive: true,
    } as any)) as any;
    const organizationId = org.id;
    console.log(`  Created: ${organizationId}`);

    console.log('\nCreating users...');
    const { userIds, medicIds, credentials } = await seedUsers(organizationId);

    const insurers = await pickInsurers();
    console.log(`\nUsing insurers: ${insurers.map((i) => i.shortName).join(', ')}`);

    console.log('\nCreating accounting settings (insurer prices) for medics...');
    await seedAccountingSettings(organizationId, medicIds, insurers);
    console.log(`  Created settings for ${medicIds.length} medics.`);

    console.log('\nCreating system practices and practice codes...');
    const practiceCodeCount = await seedPracticeCodes(organizationId, medicIds, insurers);
    console.log(`  Created ${practiceCodeCount} practice codes.`);

    console.log(`\nCreating ${PATIENT_COUNT} patients...`);
    const patientIds = await seedPatients(organizationId, insurers);
    console.log(`  Created ${patientIds.length} patients.`);

    console.log(`\nCreating encounters (${ENCOUNTERS_PER_MONTH.min}–${ENCOUNTERS_PER_MONTH.max}/month over ${HISTORY_MONTHS} months per patient)...`);
    const encounterCount = await seedEncounters(organizationId, medicIds, patientIds);
    console.log(`  Created ${encounterCount} encounters.`);

    console.log(`\nCreating studies with results (${STUDIES_PER_MONTH.min}–${STUDIES_PER_MONTH.max}/month over ${HISTORY_MONTHS} months per patient)...`);
    const studyCount = await seedStudies(organizationId, medicIds, patientIds);
    console.log(`  Created ${studyCount} studies.`);

    console.log(`\nCreating appointments for the next ${APPOINTMENT_MONTHS} months...`);
    const appointmentCount = await seedAppointments(organizationId, medicIds, patientIds);
    console.log(`  Created ${appointmentCount} appointments.`);

    console.log(`\nCreating SIRE treatments for ~${Math.round(SIRE_TREATMENT_RATIO * 100)}% of patients...`);
    const sireCount = await seedSireTreatments(organizationId, medicIds, patientIds);
    console.log(`  Created ${sireCount} treatments (with dose schedules and INR readings).`);

    console.log(`\nTampering ${TAMPERED_ENCOUNTER_COUNT} encounters for the integrity demo...`);
    const tampered = await tamperEncountersForDemo(patientIds);

    console.log('\n=== Summary ===');
    console.log(`  Organization: ${ORG_NAME} (${organizationId})`);
    console.log(`  Users: ${userIds.length}`);
    console.log(`  Patients: ${patientIds.length}`);
    console.log(`  Encounters: ${encounterCount}`);
    console.log(`  Studies: ${studyCount}`);
    console.log(`  Appointments: ${appointmentCount}`);
    console.log(`  SIRE treatments: ${sireCount}`);
    console.log('\n=== INTENTIONALLY tampered encounters (integrity demo) ===');
    console.log('  These MUST show the red integrity warning in the UI:');
    for (const t of tampered) {
      console.log(`  encounter ${t.id} — patient ${t.patientId} — ${t.date}`);
    }
    console.log('\n=== Credentials ===');
    for (const cred of credentials) {
      console.log(`  ${cred.username.padEnd(16)} ${PASSWORD}  (${cred.roles})`);
    }
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
})();
