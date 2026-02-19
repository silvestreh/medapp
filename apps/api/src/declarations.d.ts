import type { Application as ExpressFeathers } from '@feathersjs/express';
import type { Service, Params, Paginated, Id } from '@feathersjs/feathers';
import countries from '../data/countries.json';

export type CountryCode = keyof typeof countries;
export type PhoneNumber = `tel:${string}` | `cel:${string}` | null;
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
  rnas: string | null;
  enemp: string | null;
  denomination: string;
  shortName: string;
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
  roleId: Id;
  personalData: Partial<PersonalData>;
  contactData: Partial<ContactData>;
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
  patientId: Id;
  medicId: Id;
  date: Date;
  data: {
    [key: string]: any;
  } | string;
}

export interface MdSettings {
  id: Id;
  userId: Id;
  medicalSpecialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
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
