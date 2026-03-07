"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Users = void 0;
const axios_1 = __importDefault(require("axios"));
const errors_1 = require("@feathersjs/errors");
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
class Users {
    constructor(app) {
        this.id = 'id';
        this.app = app;
        this.mainApiUrl = app.get('mainApiUrl');
    }
    async get(id, params) {
        var _a, _b, _c, _d;
        const key = String(id);
        const cached = userCache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }
        try {
            const accessToken = (_a = params === null || params === void 0 ? void 0 : params.authentication) === null || _a === void 0 ? void 0 : _a.accessToken;
            const response = await axios_1.default.get(`${this.mainApiUrl}/users/${id}`, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });
            const user = response.data;
            userCache.set(key, { data: user, expiry: Date.now() + CACHE_TTL });
            return user;
        }
        catch (err) {
            if (((_b = err.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
                throw new errors_1.NotFound(`User ${id} not found`);
            }
            // If the main API returns an auth/permission error, return minimal user data.
            // The JWT is already verified locally — we just need the user entity for Feathers.
            if (((_c = err.response) === null || _c === void 0 ? void 0 : _c.status) === 401 || ((_d = err.response) === null || _d === void 0 ? void 0 : _d.status) === 403) {
                const minimalUser = { id: String(id), username: '' };
                userCache.set(key, { data: minimalUser, expiry: Date.now() + CACHE_TTL });
                return minimalUser;
            }
            throw err;
        }
    }
    async find(_params) {
        return { total: 0, data: [] };
    }
}
exports.Users = Users;
