import type { Application as ExpressFeathers } from '@feathersjs/express';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceTypes {}

export type Application = ExpressFeathers<ServiceTypes>;

export interface VerificationSession {
  id: string;
  userId: string;
  token: string;
  status: 'waiting' | 'uploading' | 'completed' | 'expired';
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
