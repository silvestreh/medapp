import { Params, Id, Paginated } from '@feathersjs/feathers';
import { NotFound, GeneralError } from '@feathersjs/errors';
import axios from 'axios';
import type { Application, IdentityVerification } from '../../declarations';

const VERIFICATION_API_URL = process.env.VERIFICATION_API_URL || 'http://localhost:3032';

/**
 * Forwards identity-verification CRUD to the verification API.
 * Same pattern as chat/verification Users classes: uses axios + JWT from
 * the incoming request to call the remote API.
 */
export class IdentityVerifications {
  app: Application;
  id: string = 'id';

  constructor(app: Application) {
    this.app = app;
  }

  private getHeaders(params?: Params): Record<string, string> {
    const headers: Record<string, string> = {};
    const accessToken = params?.authentication?.accessToken;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
  }

  async find(params?: Params): Promise<Paginated<IdentityVerification>> {
    const headers = this.getHeaders(params);
    const response = await axios.get(`${VERIFICATION_API_URL}/identity-verifications`, {
      headers,
      params: params?.query,
    });
    return response.data;
  }

  async get(id: Id, params?: Params): Promise<IdentityVerification> {
    const headers = this.getHeaders(params);
    try {
      const response = await axios.get(`${VERIFICATION_API_URL}/identity-verifications/${id}`, {
        headers,
      });
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFound('Verification not found');
      throw new GeneralError(err.response?.data?.message || err.message);
    }
  }

  async create(data: Partial<IdentityVerification>, params?: Params): Promise<IdentityVerification> {
    const headers = this.getHeaders(params);
    const response = await axios.post(`${VERIFICATION_API_URL}/identity-verifications`, data, {
      headers,
    });
    return response.data;
  }

  async patch(id: Id, data: Partial<IdentityVerification>, params?: Params): Promise<IdentityVerification> {
    const headers = this.getHeaders(params);
    try {
      const response = await axios.patch(`${VERIFICATION_API_URL}/identity-verifications/${id}`, data, {
        headers,
      });
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 404) throw new NotFound('Verification not found');
      throw new GeneralError(err.response?.data?.message || err.message);
    }
  }
}
