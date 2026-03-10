import axios from 'axios';
import { NotFound } from '@feathersjs/errors';
import { Id, Params } from '@feathersjs/feathers';
import { Application } from '../../declarations';

interface VerificationUser {
  id: string;
  username: string;
}

const userCache = new Map<string, { data: VerificationUser; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class Users {
  app: Application;
  mainApiUrl: string;
  id: string = 'id';

  constructor(app: Application) {
    this.app = app;
    this.mainApiUrl = app.get('mainApiUrl');
  }

  async get(id: Id, params?: Params): Promise<VerificationUser> {
    const key = String(id);
    const cached = userCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    try {
      const accessToken = params?.authentication?.accessToken;
      const response = await axios.get(`${this.mainApiUrl}/users/${id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      const user: VerificationUser = { id: response.data.id, username: response.data.username };
      userCache.set(key, { data: user, expiry: Date.now() + CACHE_TTL });
      return user;
    } catch (err: any) {
      if (err.response?.status === 404) {
        throw new NotFound(`User ${id} not found`);
      }

      // If the main API returns an auth/permission error, return minimal user data.
      // The JWT is already verified locally — we just need the user entity for Feathers.
      if (err.response?.status === 401 || err.response?.status === 403) {
        const minimalUser: VerificationUser = { id: String(id), username: '' };
        userCache.set(key, { data: minimalUser, expiry: Date.now() + CACHE_TTL });
        return minimalUser;
      }

      throw err;
    }
  }

  async find(_params?: Params): Promise<any> {
    return { total: 0, data: [] };
  }
}
