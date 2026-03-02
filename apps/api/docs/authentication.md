# Authentication & Authorization

## Authentication

The API supports three authentication methods, all managed through FeathersJS's authentication system.

### JWT

All authenticated requests use a JWT bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Configuration (from `config/default.json`):

- Algorithm: HS256
- Expiry: 1 day
- Audience/issuer: configurable per environment

### Local (Username + Password)

```
POST /authentication
{
  "strategy": "local",
  "username": "doctor@example.com",
  "password": "SecurePass1"
}
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "...", "username": "doctor@example.com", ... }
}
```

Password requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

If the user's password does not meet current policy, the response includes `user.hasWeakPassword: true` — the client can prompt a password change.

**Rate limiting:** Local login attempts are rate-limited to 10 per minute per IP (configurable via `AUTH_RATE_LIMIT_MAX`). JWT re-authentication is not throttled.

### Two-Factor Authentication (2FA)

2FA uses TOTP (Time-based One-Time Password) compatible with apps like Google Authenticator and Authy.

**Setup flow** (via the `profile` service):

1. `POST /profile { "action": "setup-2fa" }` — Returns a `secret` and `otpauthUri` for QR code generation.
2. User scans the QR code in their authenticator app.
3. `POST /profile { "action": "enable-2fa", "twoFactorCode": "123456" }` — Verifies and enables 2FA.

**Login with 2FA:**

If 2FA is enabled and the user logs in without a code, the API returns:

```json
{
  "code": 401,
  "data": { "reason": "2fa_required" }
}
```

The client then re-submits with the code:

```
POST /authentication
{
  "strategy": "local",
  "username": "doctor@example.com",
  "password": "SecurePass1",
  "twoFactorCode": "123456"
}
```

Invalid codes return `{ "reason": "invalid_2fa_code" }`.

### WebAuthn / Passkeys

The API supports passwordless authentication via WebAuthn passkeys using `@simplewebauthn/server`.

**Registration:**

1. `POST /webauthn { "action": "generate-registration-options" }` — Returns challenge options.
2. Client completes the browser WebAuthn ceremony.
3. `POST /webauthn { "action": "verify-registration", "credential": { ... } }` — Stores the credential.

**Authentication:**

1. `POST /webauthn { "action": "generate-authentication-options" }` — Returns challenge options.
2. Client completes the browser WebAuthn ceremony.
3. `POST /webauthn { "action": "verify-authentication", "credential": { ... } }` — Returns a JWT.

Configuration:
- `WEBAUTHN_RP_ID` — The domain users see (e.g., `app.example.com`). Must match the UI domain, not the API domain.
- `WEBAUTHN_RP_NAME` — Display name in passkey prompts (default: `MedApp`).
- `WEBAUTHN_ORIGIN` — Full origin with protocol (e.g., `https://app.example.com`).

## Authorization

### Role-Based Access Control (RBAC)

Permissions are enforced by the `checkPermissions` hook (`src/hooks/check-permissions.ts`).

**Permission format:** `<service>:<method>[:<scope>][.<field>]`

Examples:
- `patients:find` — Can list own patients (scoped via `foreignKey`)
- `patients:find:all` — Can list all patients in the organization
- `encounters:create` — Can create encounters for self
- `appointments:patch.status` — Can only update the `status` field

**Permission levels:**

| Level | Format | Behavior |
|---|---|---|
| Full | `service:method:all` | Unrestricted access within the organization |
| Base | `service:method` | Scoped to own records via `foreignKey` |
| Field | `service:method.field` | Write access limited to specific fields |

When a user has field-level permissions, the hook strips all other fields from the request body on `create`, `patch`, and `update`.

**Super admin:** Users with `isSuperAdmin: true` bypass permission checks. This flag cannot be set through the API.

### Organization Scoping

All data access is scoped to the user's active organization:

1. **`setOrganizationContext`** (global before hook) — Reads the organization ID from the request and attaches it to `params`.
2. **`verifyOrganizationMembership`** — Confirms the user is a member of the active organization.
3. **`enforceActiveOrganization`** — Rejects requests if the organization is deactivated.
4. **`checkPermissions` with `scopeToOrganization`** — Automatically filters queries and sets `organizationId` on creates.

Cross-organization data access is not possible through the API — records belonging to other organizations are rejected with a `403 Forbidden`.

### Roles

Roles are defined in the `roles` table and assigned to users per organization via `user_roles`. Each role contains an array of permission strings.

Permissions are resolved at request time by querying the user's roles for the active organization and merging all permission arrays.
