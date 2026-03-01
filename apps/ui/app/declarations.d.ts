export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  roleIds: string[];
  permissions: string[];
}

export interface Account {
  id: string;
  username: string;
  twoFactorEnabled?: boolean;
  hasWeakPassword?: boolean;
  isSuperAdmin?: boolean;
  organizations?: UserOrganization[];
  personalData?: PersonalData;
  contactData?: ContactData;
  settings?: {
    medicalSpecialty: string;
    nationalLicenseNumber: string;
    stateLicense: string;
    stateLicenseNumber: string;
    mondayStart: string;
    mondayEnd: string;
    tuesdayStart: string | null;
    tuesdayEnd: string | null;
    wednesdayStart: string;
    wednesdayEnd: string;
    thursdayStart: string | null;
    thursdayEnd: string | null;
    fridayStart: string;
    fridayEnd: string;
    saturdayStart: string | null;
    saturdayEnd: string | null;
    sundayStart: string | null;
    sundayEnd: string | null;
    encounterDuration: number;
  };
}

export type Prepaga = {
  id: string;
  shortName: string;
  denomination: string;
};

export type Patient = {
  id: string;
  medicare?: string | null;
  medicareId?: string | null;
  medicareNumber: string;
  prepaga?: Prepaga | null;
  contactData: {
    city: string;
    country: string;
    email: string;
    phoneNumber: string[];
    province: string;
    streetAddress: string;
  };
  personalData: {
    documentValue: string;
    documentType: string;
    firstName: string;
    gender: string;
    lastName: string;
    maritalStatus: string;
    nationality: string;
    birthDate: string | null;
  };
};

export type Appointment = {
  id: string;
  duration?: number;
  extra?: boolean;
  medicId: string;
  patient: Patient;
  patientId: string;
  startDate: string;
};

export interface Slot {
  date: string;
  appointment: Appointment | null;
}

export type PricingType = 'fixed' | 'multiplier';

export type PricingConfig = {
  type: PricingType;
  value?: number;
  baseValue?: number;
  multiplier?: number;
  baseName?: string;
  code?: string;
};
