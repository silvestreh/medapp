export type AccountingRecord = {
  id: string;
  practiceCostId: string;
  date: string;
  kind: string;
  protocol: number | null;
  insurerId: string | null;
  insurerName: string;
  patientName: string;
  cost: number;
  billedAt: string | null;
};

export type AccountingResult = {
  records: AccountingRecord[];
  totalRevenue: number;
  revenueByDay: { date: string; revenue: number }[];
  revenueByInsurer: { insurer: string; revenue: number }[];
};

export type UncostedPractice = {
  practiceId: string;
  practiceType: 'studies' | 'encounters';
  date: string;
  patientId: string;
  insurerId: string | null;
  effectiveInsurerId: string;
  emergency: boolean;
  studies?: string[];
  patientName: string;
};
