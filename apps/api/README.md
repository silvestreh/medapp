# MedApp API

> A FeathersJS API for managing medical appointments and patient data.

## Prerequisites

- Node.js >= 18
- PostgreSQL
- pnpm

## Setup

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in `apps/api/`:

```bash
# Required
ENCRYPTION_KEY=       # openssl rand -base64 32
DB_URL=               # PostgreSQL connection string (production only)

# WebAuthn / Passkeys
WEBAUTHN_RP_ID=       # Domain users visit, e.g. app.example.com (default: localhost)
WEBAUTHN_RP_NAME=     # Display name shown in passkey prompts (default: MedApp)
WEBAUTHN_ORIGIN=      # Full origin of the UI, e.g. https://app.example.com (default: http://localhost:5173)

# Optional
DEBUG=                # Set to "true" for verbose logging on every service method
TOTP_ISSUER=          # Issuer label for 2FA authenticator apps (default: MedApp)
```

> **Important:** `WEBAUTHN_RP_ID` must be the domain the user sees in their browser (the UI domain, not the API domain). `WEBAUTHN_ORIGIN` must include the protocol (`https://`). For local development, the defaults work out of the box.

### 3. Initialize the database

This creates the database, runs all migrations, and seeds roles, ICD-10 codes, and medications:

```bash
pnpm --filter medapp-api db:init
```

### 4. Start the dev server

```bash
pnpm --filter medapp-api dev
```

The API will be available at `http://localhost:3030`.

## Configuration

The app uses [`@feathersjs/configuration`](https://docs.feathersjs.com/api/configuration.html) which loads JSON config files from `config/` based on `NODE_ENV`:

| File | Used when |
|---|---|
| `config/default.json` | Always loaded as base config |
| `config/production.json` | Merged on top when `NODE_ENV=production` |
| `config/test.json` | Merged on top when `NODE_ENV=test` |

In `production.json`, values like `"HOST"`, `"PORT"`, and `"DB_URL"` are resolved from environment variables of the same name.

## Encryption

This project uses two types of encryption:

1. **Non-deterministic** encryption of medical records using [pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html).
2. **Deterministic** encryption for sensitive but queryable data such as national IDs, names, and health insurance numbers.

The `ENCRYPTION_KEY` environment variable is required for both. Generate one with:

```bash
openssl rand -base64 32
```

Keep this key secure -- it is required to decrypt all existing data.

## Database Scripts

| Script | Description |
|---|---|
| `pnpm db:init` | Create database, tables, and seed data |
| `pnpm db:reset` | Drop and recreate all tables (destructive) |
| `pnpm db:drop` | Drop the database entirely (destructive) |
| `pnpm db:create-seeds` | Generate seed data |
| `pnpm db:import-seeds` | Import seed data from files |

If needed, you can run the `db:import-seeds` through the Railway CLI to seed the remote DB.

## Deploying to Railway

Set these environment variables on your Railway API service:

| Variable | Example |
|---|---|
| `HOST` | `0.0.0.0` |
| `PORT` | `8080` (or let Railway assign one) |
| `DB_URL` | `postgres://user:pass@host:5432/railway` |
| `ENCRYPTION_KEY` | *(output of `openssl rand -base64 32`)* |
| `WEBAUTHN_RP_ID` | `app.example.com` |
| `WEBAUTHN_RP_NAME` | `MedApp` |
| `WEBAUTHN_ORIGIN` | `https://app.example.com` |
| `NODE_ENV` | `production` |

In Railway, you can reference environment variables from other services, like `${{medapp-api.RAILWAY_PRIVATE_DOMAIN}}` or `${{Postgres.DATABASE_URL}}`. Use these and try to favor internal networking to avoid egress costs.

If the UI and API live on different subdomains (e.g. `app.example.com` and `api.example.com`), set `WEBAUTHN_RP_ID` to the common parent domain (e.g. `example.com`).

## Data Migration Scripts

These scripts migrate data from legacy MongoDB databases.

### Pulling data (`scripts/pull-data.sh`)

Pulls MongoDB collections from a remote server (via SSH) and a MongoDB Atlas cluster:

```bash
./scripts/pull-data.sh -u <mongodb_username> -w <mongodb_password> [-p <ssh_port>] [-m <mongodb_port>] -a <atlas_password>
```

| Option | Description |
|---|---|
| `-u` | MongoDB username |
| `-w` | MongoDB password |
| `-p` | SSH port (default: 22) |
| `-m` | MongoDB port (default: 27017) |
| `-a` | MongoDB Atlas password |

### Importing data (`scripts/import-mongo-dumps.ts`)

This is the legacy import script. It mutates the MongoDB dumps into the appropriate format for the new API. It is slow, but functional. Look at the [DB scripts](#database-scripts) above. **This erases all existing data before importing.**

```bash
npx ts-node scripts/import-mongo-dumps.ts
```
