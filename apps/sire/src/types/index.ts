export interface Patient {
  id: string;
  organizationId: string;
  personalData?: {
    firstName?: string;
    lastName?: string;
  };
}

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
  id: string;
  patientId: string;
  organizationId: string;
  medicId: string;
  medication: string;
  tabletDoseMg: number;
  indication: string | null;
  targetInrMin: number;
  targetInrMax: number;
  startDate: string;
  endDate: string | null;
  nextControlDate: string | null;
  status: 'active' | 'paused' | 'completed';
  notes: string | null;
}

export interface SireReading {
  id: string;
  treatmentId: string;
  patientId: string;
  organizationId: string;
  date: string;
  inr: number;
  quick: number | null;
  percentage: number | null;
  source: 'provider' | 'patient' | 'lab';
  createdAt?: string;
}

export interface SireDoseSchedule {
  id: string;
  treatmentId: string;
  readingId: string | null;
  startDate: string;
  endDate: string | null;
  schedule: WeeklySchedule;
  notes: string | null;
  createdById: string;
}

export interface SireDoseLog {
  id: string;
  treatmentId: string;
  patientId: string;
  date: string;
  taken: boolean;
  expectedDose: number | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  medicId: string;
  startDate: string;
  medic?: {
    personalData?: {
      firstName?: string;
      lastName?: string;
    };
  };
}
