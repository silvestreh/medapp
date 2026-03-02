# API Reference

Base URL: `http://localhost:3030` (development)

All endpoints follow FeathersJS REST conventions. Unless noted otherwise, each service supports:

| Method | HTTP | Route | Description |
|---|---|---|---|
| find | `GET /service` | List records (paginated) |
| get | `GET /service/:id` | Get single record |
| create | `POST /service` | Create record |
| patch | `PATCH /service/:id` | Partial update |
| remove | `DELETE /service/:id` | Delete record |

Default pagination: 10 per page, max 50. Use `$limit` and `$skip` query params to paginate.

## Authentication

### `POST /authentication`

Login and obtain a JWT.

**Local strategy:**
```json
{
  "strategy": "local",
  "username": "doctor@example.com",
  "password": "SecurePass1",
  "twoFactorCode": "123456"
}
```

**JWT strategy (re-authenticate):**
```json
{
  "strategy": "jwt",
  "accessToken": "eyJhbGciOi..."
}
```

---

## Core Services

### Users (`/users`)

Manage system users (doctors, staff, admins).

- **find** — List users (organization-scoped)
- **get** — Get user by ID
- **create** — Register a new user (`username`, `password` required)
- **patch** — Update user fields
- **remove** — Delete user

Related data is included automatically: personal data (name, document) and contact data (email, phone, address).

### Profile (`/profile`)

User self-service actions. All require authentication.

**Actions** (sent as `POST /profile`):
- `{ "action": "setup-2fa" }` — Generate TOTP secret and QR URI
- `{ "action": "enable-2fa", "twoFactorCode": "..." }` — Enable 2FA
- `{ "action": "change-password", "oldPassword": "...", "newPassword": "..." }` — Change password
- `{ "action": "update-profile", ... }` — Update own profile data

### Patients (`/patients`)

Patient records management.

- **find** — Search patients (supports fuzzy name search via `$search` param)
- **get** — Get patient with personal + contact data
- **create** — Register new patient (auto-links to active organization)
- **patch** — Update patient
- **remove** — Delete patient

Patients are scoped to the active organization. Creating a patient auto-creates linked `personal_data` and `contact_data` records.

### Appointments (`/appointments`)

Schedule and manage medical appointments.

- **find** — List appointments (filterable by date range, doctor, patient, status)
- **create** — Create appointment
- **patch** — Update appointment (supports bulk patch)
- **remove** — Delete appointment

A monthly cron job cleans up appointments older than 3 months.

### Encounters (`/encounters`)

Medical consultations / patient visits. The `data` field stores the clinical record and is encrypted at rest.

- **find** — List encounters
- **get** — Get encounter (data is decrypted on read)
- **create** — Create encounter (requires verified medical license)
- **patch** — Update encounter

---

## Organization Management

### Organizations (`/organizations`)

Manage healthcare organizations/clinics.

- **find** — List orgs the user belongs to
- **get** — Get org details
- **create** — Create organization
- **patch** — Update org settings

### Organization Users (`/organization-users`)

Membership linking users to organizations.

- **find** — List org members
- **create** — Add user to org
- **remove** — Remove user from org

### Organization Patients (`/organization-patients`)

Link patients to organizations.

- **find** — List org patients
- **create** — Link patient to org
- **remove** — Unlink patient

### Invites (`/invites`)

Send email invitations to join an organization.

- **find** — List pending invites
- **create** — Send invite (triggers email via Mailgun)
- **patch** — Accept/reject invite
- **remove** — Cancel invite

### Roles (`/roles`)

Role definitions with permission arrays.

- **find** — List roles
- **create** — Create role
- **patch** — Update role permissions

### User Roles (`/user-roles`)

Assign roles to users within an organization.

- **find** — List assignments
- **create** — Assign role to user
- **remove** — Remove role from user

---

## Medical Data

### MD Settings (`/md-settings`)

Medical professional settings: license numbers, specialty, schedule, office hours.

- **find** — List settings
- **get** — Get doctor settings
- **create** — Create settings
- **patch** — Update settings

### Studies (`/studies`)

Medical study / lab test orders.

- **find** — List studies for a patient
- **create** — Order a study
- **patch** — Update study

### Study Results (`/study-results`)

Results for ordered studies.

- **find** — List results
- **create** — Upload result
- **patch** — Update result

### ICD-10 (`/icd-10`)

International Classification of Diseases code catalog. Read-only reference data.

- **find** — Search codes by text or code

### Medications (`/medications`)

Medication database. Read-only reference data.

- **find** — Search medications (full-text search with trigram matching)

### Laboratories (`/laboratories`)

Lab directory.

- **find** — List labs
- **create** — Add lab

### Prepagas (`/prepagas`)

Health insurance providers (prepagas).

- **find** — List insurers (supports filtering hidden insurers)

### Referring Doctors (`/referring-doctors`)

External referring physicians.

- **find** — List referring doctors
- **create** — Add referring doctor
- **patch** — Update
- **remove** — Delete

### Time-Off Events (`/time-off-events`)

Doctor availability and vacation management.

- **find** — List time-off events
- **create** — Create time-off event
- **patch** — Update
- **remove** — Delete

---

## Personal & Contact Data

These services manage encrypted PII. They are typically accessed indirectly through users/patients, but are also available directly.

### Personal Data (`/personal-data`)

Encrypted: `firstName`, `lastName`, `documentType`, `documentValue`, `birthDate`, `nationality`, `biologicalSex`.

### Contact Data (`/contact-data`)

Encrypted: `address`, `phone`, `email`, `city`, `state`, `zipCode`.

### Linking Services

- `/user-personal-data` — Links users to personal data
- `/user-contact-data` — Links users to contact data
- `/patient-personal-data` — Links patients to personal data
- `/patient-contact-data` — Links patients to contact data

---

## Security & Credentials

### WebAuthn (`/webauthn`)

Passkey registration and authentication. See [Authentication docs](./authentication.md#webauthn--passkeys).

### Passkey Credentials (`/passkey-credentials`)

Stored WebAuthn credentials (internal use).

### Signing Certificates (`/signing-certificates`)

PDF signing certificates for digitally signed medical documents.

- **find** — List certificates
- **create** — Upload certificate (P12 format)
- **remove** — Delete certificate

### Signed Exports (`/signed-exports`)

Generate digitally signed PDF exports of medical records.

- **create** — Generate signed PDF

---

## AI Features

### LLM Provider Keys (`/llm-provider-keys`)

Store API keys for AI providers.

- **find** — List configured providers
- **create** — Add provider key
- **remove** — Delete key

### LLM Models (`/llm-models`)

Configure available AI models.

- **find** — List models
- **create** — Add model config

### Encounter AI Chat (`/encounter-ai-chat`)

AI conversation threads linked to encounters.

- **find** — List threads
- **create** — Start new thread

### Encounter AI Chat Messages (`/encounter-ai-chat-messages`)

Messages within AI conversation threads.

- **find** — List messages in a thread
- **create** — Send message (triggers AI response)

---

## Financial

### Accounting (`/accounting`)

Billing and payment records.

- **find** — List records (scoped to organization)
- **create** — Create billing record
- **patch** — Update record

### Accounting Settings (`/accounting-settings`)

Per-user/organization billing configurations (pricing, categories).

- **find** — List settings
- **create** — Create settings
- **patch** — Update settings

---

## Other

### Stats (`/stats`)

Analytics and statistics. Read-only.

- **find** — Get aggregated stats for the organization

### Practitioner Verification (`/practitioner-verification`)

Verify medical license status against external registries.

### Mailer (`/mailer`)

Internal email sending service (not directly exposed to clients).

---

## Query Syntax

FeathersJS supports standard query operators:

```
GET /patients?$limit=25&$skip=0&$sort[createdAt]=-1
GET /appointments?status=confirmed&medicId=abc-123
GET /icd-10?code[$like]=A0%
GET /patients?$search=john           # fuzzy name search
```

Common operators: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`, `$nin`, `$like`, `$iLike`, `$or`, `$sort`, `$select`, `$limit`, `$skip`.
