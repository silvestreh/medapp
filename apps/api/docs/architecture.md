# Architecture

## Overview

The API is a FeathersJS v4 application running on Express. It exposes both REST and WebSocket transports, uses Sequelize as the ORM with PostgreSQL, and applies a hook-based middleware pipeline for authentication, authorization, encryption, and data transformation.

## Directory Structure

```
apps/api/
├── config/                  # Environment-specific JSON configs
│   ├── default.json         # Base settings (always loaded)
│   ├── production.json      # Production overrides (env vars)
│   └── test.json            # Test overrides
├── scripts/                 # DB management & data migration scripts
├── src/
│   ├── app.ts               # Express + Feathers app assembly
│   ├── app.hooks.ts         # Global before/after/error hooks
│   ├── authentication.ts    # Auth service registration
│   ├── channels.ts          # WebSocket channel subscriptions
│   ├── index.ts             # Server startup + cron scheduling
│   ├── sequelize.ts         # DB connection, sync, encryption helpers
│   ├── two-factor-local-strategy.ts  # Custom 2FA login strategy
│   ├── logger.ts            # Winston logger
│   ├── sentry.ts            # Sentry error reporting
│   ├── models/              # Sequelize model definitions
│   ├── services/            # FeathersJS service modules
│   ├── hooks/               # Reusable hook functions
│   ├── cron/                # Scheduled tasks
│   ├── middleware/           # Express middleware
│   └── utils/               # Shared utilities
└── test/                    # Mocha test suite
```

## Request Lifecycle

```
Client Request
  │
  ▼
Express (helmet, CORS, rate limiter, body parsers)
  │
  ▼
FeathersJS Router → resolves to service + method
  │
  ▼
Global before hooks (app.hooks.ts)
  ├── Debug logging (if DEBUG=true)
  └── setOrganizationContext()
  │
  ▼
Service-level before hooks
  ├── authenticate('jwt')
  ├── verifyOrganizationMembership()
  ├── checkPermissions()
  ├── encryption / data transforms
  └── custom service hooks
  │
  ▼
Service method (find/get/create/patch/remove)
  │
  ▼
Service-level after hooks
  ├── includeDecryptedAttributes()
  ├── includeData() (join personal/contact data)
  └── custom transforms
  │
  ▼
Global after hooks
  │
  ▼
Response → Client
  │
  (on error) → Sentry capture + error handler
```

## Services

Each service lives in `src/services/<name>/` and typically contains:

- `<name>.service.ts` — Registers the service on the app and applies hooks
- `<name>.hooks.ts` — Hook configuration for this service (optional, some inline hooks)
- `<name>.class.ts` — Custom service class (when overriding default Sequelize behavior)

FeathersJS maps services to REST endpoints automatically:

| Service Method | HTTP Verb | Route |
|---|---|---|
| `find` | `GET` | `/<service>` |
| `get` | `GET` | `/<service>/:id` |
| `create` | `POST` | `/<service>` |
| `update` | `PUT` | `/<service>/:id` |
| `patch` | `PATCH` | `/<service>/:id` |
| `remove` | `DELETE` | `/<service>/:id` |

## Real-Time Channels

WebSocket connections are organized into channels (see `src/channels.ts`):

- **`anonymous`** — All unauthenticated connections.
- **`authenticated`** — All logged-in users.
- **`organizations/{orgId}`** — Users belonging to a specific organization.

On login, the server queries the user's organization memberships and joins them to the appropriate organization channels. Events published from services with an `organizationId` field are scoped to that organization's channel; all others go to `authenticated`.

## Hooks

Hooks are the core middleware abstraction in FeathersJS. They run before, after, or on error for any service method. Reusable hooks live in `src/hooks/`:

| Hook | Purpose |
|---|---|
| `checkPermissions` | RBAC enforcement with field-level filtering |
| `verifyOrganizationMembership` | Ensures user belongs to the active org |
| `enforceActiveOrganization` | Blocks requests to deactivated orgs |
| `setOrganizationContext` | Reads org ID from request headers/params |
| `includeData` | Joins personal/contact data into responses |
| `includeDecryptedAttributes` | Adds decrypted columns to queries |
| `encryption` | Handles encrypt/decrypt lifecycle |
| `queryEncryptedFields` | Enables searching on encrypted columns |
| `scopePatientsToOrganization` | Filters patients to current org |
| `scopeUsersToOrganization` | Filters users to current org |
| `createPersonalData` | Auto-creates linked personal_data records |
| `createContactData` | Auto-creates linked contact_data records |
| `linkPatientToOrganization` | Auto-links new patients to the active org |
| `findByPersonalData` | Fuzzy search by PII fields |
| `omitForDeleted` | Excludes soft-deleted records |
| `requireVerifiedLicense` | Blocks encounters without valid license |
| `blockSuperAdmin` | Prevents certain super-admin actions |
| `authorizeOrgManagement` | Restricts org management to admins |
| `lowerCase` | Normalizes fields to lowercase |

## Cron Jobs

Defined in `src/cron/` and started in `src/index.ts`:

| Job | Schedule | Action |
|---|---|---|
| Appointment cleanup | 1st of each month, midnight | Deletes appointments older than 3 months |
| License revalidation | Periodic | Re-checks medical license validity |
