# FHIR Wrapper API

Read-only FHIR R4 API that exposes the existing Athelas database as HL7 Argentina (AR.FHIR.CORE) compliant resources for interoperability with the national Bus (DNSIS).

## Setup

### Prerequisites

- Node.js >= 20
- PostgreSQL (same database as `apps/api` — `athelas_api`)
- `pnpm install` from the monorepo root

### Environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_URL` | Yes | Postgres connection string. Must point to the same DB as `apps/api` (e.g. `postgres://postgres:@localhost:5432/athelas_api`) |
| `ENCRYPTION_KEY` | Yes | **Must match** the `ENCRYPTION_KEY` used by `apps/api`. Patient personal data (DNI, birthdate) and contact data (email, phone, address) are encrypted with AES-256-ECB using this key. Copy it from `apps/api/config/production.json` or your API `.env`. |
| `FHIR_PORT` | No | Defaults to `3040` |
| `FHIR_JWT_SECRET` | Yes (prod) | Shared secret for JWT auth. In production, this comes from the DNSIS registration. |
| `FHIR_SKIP_AUTH` | No | Set to `true` to disable JWT auth for local development. Lets you browse endpoints in the browser. |
| `DB_SSL` | No | Set to `true` for production. Defaults to `false`. |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | Set to `false` if using self-signed certs. Defaults to `true`. |

### Running locally

```bash
pnpm dev
```

With `FHIR_SKIP_AUTH=true` in your `.env`, open the browser and go to:

```
http://localhost:3040/Patient
```

### Running tests

Tests run against the `athelas_api_test` database:

```bash
pnpm test
```

### Building for production

```bash
pnpm build
pnpm start
```

## Endpoints

All responses use `Content-Type: application/fhir+json; fhirVersion=4.0`.

Errors return a FHIR [OperationOutcome](https://www.hl7.org/fhir/operationoutcome.html) resource.

### `GET /metadata`

CapabilityStatement describing the server. **Public** (no auth required).

### Patient

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/Patient` | Search patients. Supports `_id`, `identifier`, `name`, `birthdate`, `gender`, `_count`, `_offset`. |
| `GET` | `/Patient/:id` | Read a single patient by ID. |
| `POST` | `/Patient/$match` | Demographic matching. Accepts a FHIR `Parameters` resource with a `Patient` in the `resource` parameter. Returns a searchset Bundle with match scores. |
| `GET` | `/Patient/:id/$summary` | Generate an IPS (International Patient Summary) Bundle for the patient. Rate-limited to 10 req/min. |

Example — search by DNI:
```
GET /Patient?identifier=12345678
```

Example — search by name:
```
GET /Patient?name=Garcia
```

### Practitioner

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/Practitioner` | Search practitioners. Supports `_id`, `name`. |
| `GET` | `/Practitioner/:id` | Read a single practitioner. |

### Organization

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/Organization` | Search organizations. Supports `_id`, `name`. |
| `GET` | `/Organization/:id` | Read a single organization. |

### Clinical Resources

These are derived from encounter data. All support `patient` as a search parameter.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/Condition` | Patient conditions (ICD-10 coded). |
| `GET` | `/AllergyIntolerance` | Drug and general allergies. |
| `GET` | `/MedicationStatement` | Medication history from encounters and prescriptions. |

Example:
```
GET /Condition?patient=<patient-id>
```

### Documents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/DocumentReference` | List document references for a patient (`patient` param required). |
| `GET` | `/Binary/:id` | Fetch encounter content as a FHIR Binary resource. Rate-limited to 10 req/min. |
| `GET` | `/Consent` | Stub — returns an empty searchset Bundle. |

## Authentication

In production, all endpoints except `/metadata` require a Bearer JWT token:

```
Authorization: Bearer <token>
```

The token is verified against `FHIR_JWT_SECRET`. For local development, set `FHIR_SKIP_AUTH=true` to bypass this.

## Rate Limiting

- **General**: 100 requests/min per IP across all endpoints.
- **Heavy endpoints** (`$summary`, `Binary`): 10 requests/min per IP.

Rate limit info is returned in response headers (`RateLimit-*`). Exceeding the limit returns a `429` with an OperationOutcome.

## Architecture

This is a **read-only wrapper** — it reads from the same PostgreSQL database as `apps/api` but never writes to it. Data flows:

```
PostgreSQL (athelas_api)
    |
    |  Sequelize (read-only)
    v
FHIR Wrapper (this app)
    |
    |  JSON over HTTPS
    v
National Interoperability Bus (DNSIS)
```

Encrypted fields (`personal_data.documentValue`, `personal_data.birthDate`, `contact_data.email`, `contact_data.phoneNumber`, `contact_data.streetAddress`, `contact_data.city`, `contact_data.province`) are decrypted at the application layer using the shared `ENCRYPTION_KEY`. Encounter `data` blobs are decrypted at the database layer via `PGP_SYM_DECRYPT`.
