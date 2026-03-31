import type { Application as ExpressFeathers } from '@feathersjs/express';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceTypes {}

export type Application = ExpressFeathers<ServiceTypes>;

export type DocumentType = 'dni' | 'passport';

export interface VerificationSession {
  id: string;
  userId: string;
  token: string;
  status: 'waiting' | 'uploading' | 'completed' | 'expired';
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  expiresAt: Date;
  clientIp: string | null;
  clientUserAgent: string | null;
  deviceFingerprint: Record<string, unknown> | null;
  idData: Record<string, unknown> | null;
  documentType: DocumentType | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityVerification {
  id: string;
  userId: string;
  sessionId: string | null;
  status: 'pending' | 'verified' | 'rejected';
  documentType: DocumentType | null;
  idFrontUrl: string;
  idBackUrl: string | null;
  selfieUrl: string;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  dniScanData: Record<string, unknown> | null;
  dniScanMatch: boolean | null;
  dniScanErrors: string | null;
  faceMatchConfidence: string | null;
  faceMatch: boolean | null;
  faceMatchError: string | null;
  autoCheckCompletedAt: Date | null;
  autoCheckProgress: { step: string; current: number | null; total: number | null; position: number | null } | null;
  clientIp: string | null;
  clientUserAgent: string | null;
  deviceFingerprint: Record<string, unknown> | null;
  idData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
