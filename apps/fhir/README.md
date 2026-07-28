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
| `FHIR_BASE_URL` | No | Public REST base URL of this server (defaults to `https://fhir.athelas.app`). Used for Bundle `fullUrl`s and searchset `self` links so references resolve. |
| `FHIR_FEDERADOR_DOMAIN` | No | Domain id assigned by the national federator during DNSIS registration. Used as the `Composition.custodian` identifier value in `$summary` bundles. Defaults to `FHIR_DOMAIN_SYSTEM`. |
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
| `GET` | `/Organization` | Search organizations. Supports `_id`, `name`, `identifier`. |
| `GET` | `/Organization/:id` | Read a single organization. Accepts the canonical id (`refes-<code>`) or a tenant org uuid. |

**Canonical establishments**: multiple tenant orgs can share one physical establishment (e.g. independent medics renting rooms in the same institution). The FHIR layer exposes **one Organization per REFES code** — resource id `refes-<code>`, named after the official REFES registry entry when the local mirror (`refes_establishments`, synced by `apps/api`) has it. Tenant rows without a `refesId` are served as-is under their uuid.

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

### AuditEvent

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/AuditEvent` | Search audit events. Supports `patient`, `agent`, `date` (with FHIR prefixes: `ge`, `le`, `eq`), `type`. |
| `GET` | `/AuditEvent/:id` | Read a single audit event by ID. |

Events include: clinical data access (encounters, studies, prescriptions), emergency access (BTG), sharing events, authentication (login/logout/failure), access control decisions (denied requests), configuration changes, system events (startup/shutdown), and role management.

Example — search by patient:
```
GET /AuditEvent?patient=<patient-id>
```

Example — search by date range:
```
GET /AuditEvent?date=ge2025-01-01&date=le2025-12-31
```

Example — search by agent (practitioner):
```
GET /AuditEvent?agent=<user-id>
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

## Conformance (AR.FHIR.CORE 0.5.0 / IPS 1.0.0)

Output is validated against the [AR.FHIR.CORE](https://guias.hl7.org.ar/site/index.html) implementation guide with the HL7 `validator_cli.jar`. Design decisions driven by the profiles:

- **`$summary` document bundles** use absolute RESTful `fullUrl`s (`FHIR_BASE_URL`) so relative references resolve. `Composition.author`/`custodian` are **logical identifiers** — the AR profile forbids references there and fixes their systems: the author is the *institution* in the REFES namespace, the custodian is the domain registered with the national federator (`http://federador.msal.gob.ar/uri`, value from `FHIR_FEDERADOR_DOMAIN`). The Organization entry stays reachable via `Patient.managingOrganization`; practitioners referenced by clinical resources (`recorder`/`informationSource`) are included as entries.
- **Empty clinical sections** carry IPS absent/unknown placeholder resources (`no-known-problems`, `no-known-medications`, `no-known-allergies`) instead of only `emptyReason`, which also satisfies the profile's ≥ 6 bundle entries. The **Immunizations section** always uses `emptyReason: unavailable` — `Immunization-ar-core` mandates `lotNumber`/`protocolApplied`/`location`, so no placeholder can conform, and the system holds no immunization data.
- **Terminology displays**: LOINC/ICD-10 `coding.display` is omitted (the tx server only accepts its canonical es-AR displays); human-readable Spanish labels live in `code.text`.
- **`MedicationStatement.effective[x]`** is mandatory in IPS — falls back to the encounter/prescription date, else a `data-absent-reason` extension.

### Known data-level limitations (cannot conform by construction)

- Patients **without `personal_data`** (no identifiers/name/gender/birthDate) violate `Patient-ar-core` mandatory elements.
- Patients whose only document is a **passport or foreign ID**: the `DocumentoUnico` slice requires the RENAPER DNI system. Confirm handling with DNSIS.
- Organizations **without a `refesId`** and practitioners **without a `nationalLicenseNumber`** (REFEPS) cannot satisfy their respective mandatory identifier slices.
