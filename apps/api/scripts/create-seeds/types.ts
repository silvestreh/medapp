export interface MongoID {
  $oid: string;
}

export interface MongoTimestamp {
  $numberLong: string;
}

export interface MongoDate {
  $date: string;
}

export interface PersonalData {
  id?: string;
  dob_year?: string;
  dob_month?: string;
  dob_day?: string;
  marital_status?: string | null;
  document_value?: string;
  document_type?: string;
  nationality?: string;
  last_name?: string;
  first_name?: string;
}

export interface ContactData {
  email?: string;
  phone_number?: string;
  phone_type?: string;
  province?: string;
  city?: string;
  street_address?: string;
}

export interface DailySchedule {
  [key: string]: {
    end: string;
    start: string;
  };
}

export interface MongoUser {
  _id: MongoID;
  username?: string;
  bf_password?: string;
  personal_data?: PersonalData;
  contact_data?: ContactData;
  country_license?: string;
  medical_specialty?: string;
  national_license_number?: string;
  schedule_all_shifts?: DailySchedule;
  schedule_all_week_custom_time?: boolean;
  schedule_all_week_end_time?: string;
  schedule_all_week_shift_duration?: number;
  schedule_all_week_start_time?: string;
  schedule_friday?: boolean;
  schedule_monday?: boolean;
  schedule_saturday?: boolean;
  schedule_sunday?: boolean;
  schedule_thursday?: boolean;
  schedule_tuesday?: boolean;
  schedule_wednesday?: boolean;
  state_license?: string;
  state_license_number?: string;
  __class?: 'Medic' | 'Receptionist' | 'SuperUser';
}

export interface MongoAppointment {
  _id: MongoID;
  patient_id: string;
  medic_id: string;
  receptionist_id: string;
  start_timestamp: MongoTimestamp;
  extra?: boolean;
}

export interface MongoEncounter {
  _id: MongoID;
  medic_id: string;
  patient_id: string;
  timestamp: MongoTimestamp;
  datas: {
    [key: string]: any;
  };
}

export interface MongoLicense {
  _id: MongoID;
  medic: MongoID;
  start: number;
  end: number;
  type: string;
}

export interface MongoPatient {
  _id: MongoID;
  personal_data: PersonalData;
  mugshot: string;
  contact_data: ContactData;
  medicare: string;
  medicare_number: string;
  medicare_plan: string;
  deleted: boolean;
}

export interface MongoStudyPatient {
  medicare: string;
  dni: string;
  last_name: string;
  first_name: string;
  id: string;
  value: string;
  label: string;
}

export interface MongoStudy {
  _id: MongoID;
  date: MongoDate;
  protocol: number;
  noOrder: boolean;
  medic: string;
  studies: {
    [key: string]: boolean;
  };
  patient: MongoStudyPatient;
  results: MongoID[];
}

export interface MongoStudyResult {
  _id: MongoID;
  study: MongoID;
  type: string;
  data: {
    [key: string]: string;
  };
}

export interface DumpData {
  users: MongoUser[];
  patients: MongoPatient[];
  encounters: MongoEncounter[];
  appointments: MongoAppointment[];
  studies: MongoStudy[];
  studyResults: MongoStudyResult[];
  licenses: MongoLicense[];
}

export interface ProcessingStats {
  total: number;
  kept: number;
  discarded: number;
  reasons: Record<string, number>;
}

// --- API-ready seed types ---

export type PhoneNumber = `tel:${string}` | `cel:${string}` | null;

export interface SeedPersonalData {
  firstName?: string;
  lastName?: string;
  nationality?: string | null;
  documentType?: string;
  documentValue: string;
  maritalStatus?: string | null;
  birthDate?: string | null;
}

export interface SeedContactData {
  streetAddress?: string;
  city?: string | null;
  province?: string | null;
  country?: string;
  phoneNumber?: PhoneNumber[] | null;
  email?: string;
}

export interface SeedMdSettings {
  userId: string;
  medicalSpecialty?: string;
  nationalLicenseNumber?: string;
  stateLicense?: string;
  stateLicenseNumber?: string;
  scheduleAllWeekCustomTime: boolean;
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
  encounterDuration: number;
}

export interface SeedUser {
  id: string;
  username: string;
  password: string;
  roleId: 'admin' | 'receptionist' | 'medic';
  additionalRoleIds?: string[];
  personalData?: SeedPersonalData;
  contactData?: SeedContactData;
  mdSettings?: SeedMdSettings;
}

export interface SeedPatient {
  id: string;
  medicare?: string;
  medicareNumber?: string;
  medicarePlan?: string;
  deleted: boolean;
  personalData?: SeedPersonalData;
  contactData?: SeedContactData;
}

export interface SeedEncounter {
  data: Record<string, any>;
  date: string;
  medicId: string;
  patientId: string;
}

export interface SeedAppointment {
  patientId: string;
  medicId: string;
  startDate: string;
  extra: boolean;
}

export interface SeedStudy {
  id: string;
  date: string;
  protocol: number;
  studies: string[];
  noOrder: boolean;
  medicId: string | null;
  referringDoctor: string | null;
  patientId: string;
}

export interface SeedResult {
  id: string;
  data: string;
  studyId: string;
  type: string;
}

export interface SeedLicense {
  medicId: string;
  startDate: string;
  endDate: string;
  type: 'vacation' | 'cancelDay' | 'other';
  notes: null;
}
