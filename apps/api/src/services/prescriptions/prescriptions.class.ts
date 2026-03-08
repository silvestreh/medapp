import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application } from '../../declarations';

export interface Prescription {
  id: string;
  organizationId: string | null;
  medicId: string;
  patientId: string;
  recetarioReference: string;
  recetarioDocumentIds: { id: number; type: string; url: string }[];
  type: 'prescription' | 'order';
  quickLinkUrl: string | null;
  quickLinkExpiresAt: Date | null;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  sharedVia: string | null;
  sharedTo: string | null;
  content: {
    diagnosis?: string;
    medicines?: { text: string; quantity: number; posology?: string; longTerm: boolean; genericOnly?: boolean; medicationId?: string }[];
    orderText?: string;
  } | null;
}

export class Prescriptions extends Service<Prescription> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
