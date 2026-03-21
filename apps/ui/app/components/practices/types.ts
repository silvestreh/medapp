export interface Practice {
  id: string;
  title: string;
  description: string;
  isSystem: boolean;
  systemKey: string | null;
}

export interface PracticeCodeRecord {
  id: string;
  practiceId: string;
  userId: string;
  insurerId: string;
  code: string;
}

export interface Prepaga {
  id: string;
  shortName: string;
  denomination: string;
}

export interface InsurerCode {
  id: string;
  insurerId: string;
  insurerShortName: string;
  code: string;
}
