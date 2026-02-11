export interface Account {
  id: string;
  username: string;
  role: {
    id: string;
    permissions: string[];
  };
  settings: {
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

export type Patient = {
  id: string;
  medicare: string;
  medicareNumber: string;
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
