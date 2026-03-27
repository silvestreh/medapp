import type { Application as ExpressFeathers } from '@feathersjs/express';
import type { Service, Params, Paginated, Id } from '@feathersjs/feathers';
import countries from '../data/countries.json';

export type CountryCode = keyof typeof countries;
export type PhoneNumber = `tel:${string}` | `cel:${string}` | null;
export type PricingType = 'fixed' | 'multiplier';
export interface PricingConfig {
  type: PricingType;
  value?: number;
  baseValue?: number;
  multiplier?: number;
  baseName?: string;
  code?: string;
}
// A mapping of service names to types. Will be extended in service files.
export interface Icd10 {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
}

export interface Laboratory {
  id: string;
  name: string;
}

export interface Medication {
  id: string;
  commercialNamePresentation: string;
  genericDrug: string;
  laboratoryId: string;
  pharmaceuticalForm?: string;
  certificateNumber?: string;
  gtin?: string;
  availability?: string;
  searchText?: string;
}

export interface Prepaga {
  id: string;
  registry: string | null;
  denomination: string;
  shortName: string;
  tiers: { name: string; code: number | null }[];
  recetarioHealthInsuranceName: string | null;
}

export interface ServiceTypes {}
// The application instance type that will be used everywhere else
export type Application = ExpressFeathers<ServiceTypes>;

export interface ServiceMethods<T> extends Service<T> {
  create(data: Partial<T>, params?: Params): Promise<T>;
  create(data: Partial<T>[], params?: Params): Promise<T[]>;
  find(params?: Params & { paginate: false }): Promise<T[]>;
  find(params?: Omit<Params, 'paginate'>): Promise<Paginated<T>>;
  get(id: Id, params?: Params): Promise<T>;
  patch(id: Id, data: Partial<T>, params?: Params): Promise<T>;
  patch(id: null, data: Partial<T>, params?: Params): Promise<T[]>;
  update(id: Id, data: T, params?: Params): Promise<T>;
  update(id: null, data: T, params?: Params): Promise<T[]>;
  remove(id: Id, params?: Params): Promise<T>;
  remove(id: null, params?: Params): Promise<T[]>;
}

export interface Patient {
  id: Id;
  mugshot?: string | null;
  medicare?: string | null;
  medicareId?: Id | null;
  medicareNumber?: string | null;
  medicarePlan?: string | null;
  deleted: boolean;
  personalData: Partial<PersonalData>;
  contactData: Partial<ContactData>;
}

export interface Role {
  id: Id;
  name: string;
  permissions: string[];
}

export interface User {
  id: Id;
  username: string;
  password: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  twoFactorTempSecret?: string | null;
  currentChallenge?: string | null;
  isSuperAdmin: boolean;
  personalData: Partial<PersonalData>;
  contactData: Partial<ContactData>;
  preferences?: Record<string, any>;
}

export interface PersonalData {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  nationality?: string | null;
  documentType?: string | null;
  documentValue?: string | null;
  maritalStatus?: string | null;
  birthDate?: Date | null;
}

export interface ContactData {
  id: Id;
  streetAddress?: string | null;
  city?: string | null;
  province?: string | null;
  country?: CountryCode | null;
  phoneNumber?: PhoneNumber[] | null;
  email?: string | null;
}

export interface PatientPersonalData {
  id: Id;
  ownerId: Id;
  personalDataId: Id;
}

export interface PatientContactData {
  id: Id;
  ownerId: Id;
  contactDataId: Id;
}

export interface UserPersonalData {
  id: Id;
  ownerId: Id;
  personalDataId: Id;
}

export interface UserContactData {
  id: Id;
  ownerId: Id;
  contactDataId: Id;
}

export interface Appointment {
  id: Id;
  patientId: Id;
  medicId: Id;
  extra: boolean;
  startDate: Date;
}

export interface TimeOffEvent {
  id: Id;
  medicId: Id;
  startDate: Date;
  endDate: Date;
  type: 'vacation' | 'cancelDay' | 'other';
  notes?: string | null;
}

export interface Encounter {
  id: Id;
  organizationId?: Id | null;
  patientId: Id;
  medicId: Id;
  date: Date;
  insurerId?: Id | null;
  data: {
    [key: string]: any;
  } | string;
  hash?: string;
  previousEncounterId?: Id | null;
  tampered?: boolean;
}

export interface MdSettings {
  id: Id;
  userId: Id;
  medicalSpecialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
  isVerified: boolean;
  licenseExpirationDate: string | null;
  verificationRetries: number;
  nextVerificationRetry: Date | null;
  scheduleAllWeekCustomTime: boolean;
  encounterDuration: number;
  mondayStart: string | null;
  mondayEnd: string | null;
  tuesdayStart: string | null;
  tuesdayEnd: string | null;
  wednesdayStart: string | null;
  wednesdayEnd: string | null;
  thursdayStart: string | null;
  thursdayEnd: string | null;
  fridayStart: string | null;
  fridayEnd: string | null;
  saturdayStart: string | null;
  saturdayEnd: string | null;
  sundayStart: string | null;
  sundayEnd: string | null;
  title: string | null;
  recetarioTitle: string | null;
  recetarioProvince: string | null;
  signatureImage: string | null;
  recetarioUserId: number | null;
  licenseVerificationError: string | null;
}

export interface AccountingSettings {
  id: Id;
  organizationId: Id | null;
  userId: Id;
  insurerPrices: Record<string, Record<string, number | PricingConfig>>;
  hiddenInsurers: string[];
}

export interface PracticeCost {
  id: Id;
  organizationId: Id | null;
  medicId: Id | null;
  patientId: Id;
  practiceId: Id;
  practiceType: 'studies' | 'encounters';
  studyType: string | null;
  insurerId: Id | null;
  emergency: boolean;
  date: Date;
  cost: number;
}

export interface Organization {
  id: Id;
  name: string;
  slug: string;
  settings: Record<string, any>;
  isActive: boolean;
}

export interface OrganizationUser {
  id: Id;
  organizationId: Id;
  userId: Id;
}

export interface UserRole {
  id: Id;
  userId: Id;
  roleId: string;
  organizationId: Id;
}

export interface OrganizationPatient {
  id: Id;
  organizationId: Id;
  patientId: Id;
}

export type AccessLogResource = 'encounters' | 'studies' | 'prescriptions' | 'shared-access' | 'authentication' | 'access-control' | 'configuration' | 'system' | 'user-management';
export type AccessAction = 'read' | 'write' | 'export' | 'grant' | 'login' | 'logout' | 'deny' | 'execute';
export type AccessPurpose = 'treatment' | 'billing' | 'emergency' | 'operations' | 'share' | 'record-management';

export interface AccessLog {
  id: Id;
  userId: Id | null;
  organizationId: Id | null;
  resource: AccessLogResource;
  patientId: Id | null;
  action: AccessAction;
  purpose: AccessPurpose;
  refesId: string | null;
  hash: string | null;
  previousLogId: Id | null;
  ip: string | null;
  metadata: Record<string, any> | null;
  createdAt?: Date;
}

export interface SharedEncounterAccess {
  id: Id;
  grantingMedicId: Id;
  grantedMedicId: Id;
  patientId: Id;
  organizationId: Id;
}

export interface PrescriptionDelegation {
  id: Id;
  medicId: Id;
  prescriberId: Id;
  organizationId: Id;
}

export interface Invite {
  id: Id;
  email: string;
  organizationId: Id;
  roleId: string;
  invitedBy: Id;
  userId: Id | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: Date;
  isNewUser: boolean;
}

export interface Study {
  id: Id;
  date: Date;
  protocol: number;
  studies: string[];
  noOrder: boolean;
  medicId: Id | null;
  referringDoctor?: string | null;
  patientId: Id;
  insurerId?: Id | null;
  results?: StudyResult[];
}

export interface StudyResult {
  id: Id;
  studyId: Id;
  type: string;
  data: {
    [key: string]: any;
  } | string;
}

export interface SigningCertificate {
  id: Id;
  userId: Id;
  certificate: string;
  fileName: string | null;
  isClientEncrypted: boolean;
}

export interface DocumentSignature {
  id: Id;
  hash: string;
  signedById: Id;
  patientId: Id;
  organizationId: Id | null;
  signerName: string;
  signedAt: Date;
  fileName: string;
  content: 'encounters' | 'studies' | 'both';
  studyId: Id | null;
  createdAt?: Date;
}

export interface Prescription {
  id: Id;
  organizationId: Id | null;
  medicId: Id;
  patientId: Id;
  recetarioReference: string;
  recetarioDocumentIds: { id: number; type: string; url: string }[];
  type: 'prescription' | 'order';
  quickLinkUrl: string | null;
  quickLinkExpiresAt: Date | null;
  status: 'pending' | 'completed' | 'cancelled' | 'expired' | 'error';
  sharedVia: string | null;
  sharedTo: string | null;
  content: {
    diagnosis?: string;
    medicines?: { text: string; quantity: number; posology?: string; longTerm: boolean; genericOnly?: boolean; medicationId?: string }[];
    orderText?: string;
  } | null;
}

export interface DniScanData {
  tramiteNumber: string;
  lastName: string;
  firstName: string;
  gender: string;
  dniNumber: string;
  exemplar: string;
  birthDate: string;
  issueDate: string;
}

export interface IdentityVerification {
  id: Id;
  userId: Id;
  status: 'pending' | 'verified' | 'rejected';
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  verifiedBy: Id | null;
  dniScanData: DniScanData | null;
  dniScanMatch: boolean | null;
  dniScanErrors: string | null;
  faceMatchConfidence: string | null;
  faceMatch: boolean | null;
  faceMatchError: string | null;
  autoCheckCompletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PatientRefreshToken {
  id: Id;
  patientId: Id;
  organizationId: Id;
  tokenHash: string;
  family: string;
  audience: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type SireTreatmentStatus = 'active' | 'paused' | 'completed';
export type SireReadingSource = 'provider' | 'patient' | 'lab';

export interface WeeklySchedule {
  monday: number | null;
  tuesday: number | null;
  wednesday: number | null;
  thursday: number | null;
  friday: number | null;
  saturday: number | null;
  sunday: number | null;
}

export interface SireTreatment {
  id: Id;
  patientId: Id;
  organizationId: Id;
  medicId: Id;
  medication: string;
  tabletDoseMg: number;
  indication: string | null;
  targetInrMin: number;
  targetInrMax: number;
  startDate: string;
  endDate: string | null;
  nextControlDate: string | null;
  status: SireTreatmentStatus;
  notes: string | null;
}

export interface SireReading {
  id: Id;
  treatmentId: Id;
  patientId: Id;
  organizationId: Id;
  date: string;
  inr: number;
  quick: number | null;
  percentage: number | null;
  source: SireReadingSource;
}

export interface SireDoseSchedule {
  id: Id;
  treatmentId: Id;
  readingId: Id | null;
  startDate: string;
  endDate: string | null;
  schedule: WeeklySchedule;
  notes: string | null;
  createdById: Id;
}

export interface SireDoseLog {
  id: Id;
  treatmentId: Id;
  patientId: Id;
  date: string;
  taken: boolean | null;
  expectedDose: number | null;
}

export interface SirePushToken {
  id: Id;
  patientId: Id;
  token: string;
  deviceName: string | null;
  platform: 'ios' | 'android' | null;
}

export interface Practice {
  id: Id;
  organizationId: Id;
  title: string;
  description: string;
  isSystem: boolean;
  systemKey: string | null;
}

export interface PracticeCode {
  id: Id;
  practiceId: Id;
  userId: Id;
  insurerId: Id;
  code: string;
}

export interface EncounterAiChatMessage {
  id: Id;
  organizationId: Id;
  patientId: Id;
  medicId: Id;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
  suggestions?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SolanaAnchorChainType = 'encounters' | 'access_logs';
export type SolanaAnchorStatus = 'pending' | 'confirmed' | 'failed';
export type SolanaVerificationStatus = 'unverified' | 'verified' | 'inconclusive' | 'mismatch';

export interface SolanaAnchor {
  id: Id;
  merkleRoot: string;
  leafCount: number;
  chainType: SolanaAnchorChainType;
  status: SolanaAnchorStatus;
  txSignature: string | null;
  slot: number | null;
  network: string;
  batchStartDate: Date;
  batchEndDate: Date;
  errorMessage: string | null;
  retryCount: number;
  verificationStatus: SolanaVerificationStatus;
  verifiedAt: Date | null;
  verificationError: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SolanaAnchorLeaf {
  id: Id;
  anchorId: Id;
  recordId: string;
  recordHash: string;
  leafIndex: number;
  createdAt?: Date;
}
