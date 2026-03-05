# Recetario Integration for ReNaPDiS Compliance

## Context

**ReNaPDiS** (Registro Nacional de Plataformas Digitales Sanitarias) is Argentina's national registry for digital health platforms. Since Jan 1, 2025, electronic prescriptions are the only valid method for medication prescribing (Decreto 345/2024).

Rather than building a fully registered e-prescription platform (CUIR, REFEPS/REFES/RENAPER, HL7 FHIR, simulation environments, etc.), we'll integrate with **Recetario** — an already-approved platform. MedApp will implement both Quick Links (embeddable button) and the full programmatic API.

---

## Recetario API Summary

**Base URL:** `https://external-api.recetario.com.ar`
**Auth:** Bearer JWT (already obtained)

### Endpoints to implement:

| Endpoint | Method | Purpose |
|---|---|---|
| `/quick-links` | POST | Generate prescription/orders links (20 min validity) |
| `/prescriptions` | POST | Create prescription programmatically |
| `/orders` | POST | Create order (studies, certificates, etc.) |
| `/prescriptions/{id}/cancel` | POST | Cancel a prescription |
| `/medical-documents` | GET | Query prescriptions/orders (filter by reference, patient, etc.) |
| `/medical-documents/share` | POST | Share via WhatsApp/email |
| `/health-insurances` | GET | List insurance companies (for mapping) |
| `/health-centers` | GET/POST/PUT | CRUD health centers (institutions) |
| `/users` | GET/POST/PUT | CRUD Recetario users (doctors) |
| `/users/{id}/signature` | PUT | Update doctor's signature |
| `/users/{id}/status` | PUT | Enable/disable users |
| `/medications` | GET | Search Recetario's medication vademecum |
| `/provinces` | GET | List provinces |

### Webhooks:
- `medical-documents.created` — prescriptions generated
- `medical-documents.shared` — docs shared with patient
- Auth: Bearer token or HMAC-SHA256
- Must respond 200 within 30s, 2 retries in 5 min

---

## Phase 1: Backend Foundation

### 1.1 Environment Config

Add to config:
```
RECETARIO_API_URL=https://external-api.recetario.com.ar
RECETARIO_JWT=<token>
RECETARIO_WEBHOOK_SECRET=<secret>
```

### 1.2 Data Model Changes

**Extend `md_settings`** ([md-settings.model.ts](apps/api/src/models/md-settings.model.ts)):
- `recetarioTitle` (STRING, nullable) — "Dr" or "Dra"
- `recetarioProvince` (STRING, nullable) — province name for prescriptions
- `signatureImage` (TEXT, nullable) — base64 signature image
- `recetarioUserId` (INTEGER, nullable) — Recetario's user ID after registration

**Extend `prepagas`** ([prepagas.model.ts](apps/api/src/models/prepagas.model.ts)):
- `recetarioHealthInsuranceName` (STRING, nullable) — exact name from Recetario

**Org settings** (existing `settings` JSONB, no schema change):
```json
{ "recetario": { "enabled": true, "healthCenterId": 123 } }
```

**New model: `prescriptions`** — tracks prescription lifecycle:
- `id` (UUID PK), `organizationId`, `medicId`, `patientId`, `encounterId` (nullable FK)
- `recetarioReference` (STRING) — unique reference sent to Recetario
- `recetarioDocumentIds` (JSONB) — array of `{ id, type: 'prescription'|'order', url }`
- `type` (ENUM: 'prescription', 'order') — what was requested
- `quickLinkUrl` (TEXT), `quickLinkExpiresAt` (DATE)
- `status` (ENUM: pending/completed/cancelled/expired)
- `sharedVia` (STRING), `sharedTo` (STRING)
- Standard timestamps

### 1.3 New Services

**File structure:**
```
apps/api/src/services/recetario/
  recetario.class.ts         # Main service (actions via create())
  recetario.hooks.ts
  recetario.service.ts
  recetario-client.ts        # HTTP client wrapper for all Recetario endpoints
  data-mapper.ts             # MedApp → Recetario data transforms

apps/api/src/services/prescriptions/
  prescriptions.class.ts     # Standard Sequelize CRUD
  prescriptions.hooks.ts
  prescriptions.service.ts
```

**`recetario-client.ts`** — thin axios wrapper with all endpoints:
- `createQuickLinks(payload)` → `{ prescriptionsLink, ordersLink }`
- `createPrescription(payload)` → `{ id, url, externalId, ... }`
- `createOrder(payload)` → `{ id, url, ... }`
- `cancelPrescription(id)` → `{}`
- `getMedicalDocuments(filters)` → `{ data: [...] }`
- `shareMedicalDocuments(payload)` → `{}`
- `getHealthInsurances()` → `[{ id, name }]`
- `getProvinces()` → `[{ id, name }]`
- `getMedications(search)` → `[...]`
- `createHealthCenter(payload)` → `{ id, ... }`
- `getHealthCenters()` → `[...]`
- `createUser(payload)` → `{ id, ... }`
- `updateUserSignature(userId, base64)` → `{}`

**`recetario.class.ts`** — actions via `create()` (pattern from [signed-exports.class.ts](apps/api/src/services/signed-exports/signed-exports.class.ts)):

| Action | Description |
|---|---|
| `quick-link` | Generate quick-link for patient, store prescription record |
| `prescribe` | Create prescription via full API (medicines, diagnosis, etc.) |
| `order` | Create order via full API (studies, certificates, etc.) |
| `cancel` | Cancel a prescription by Recetario ID |
| `share` | Share docs via WhatsApp/email |
| `check-readiness` | Return `{ ready, missingFields[] }` for current doctor |
| `sync-insurances` | Fetch & cache Recetario health insurances |
| `register-health-center` | Register org as health center in Recetario |
| `register-user` | Register doctor in Recetario |

**`data-mapper.ts`** — transformation functions:

| Function | Maps |
|---|---|
| `mapDoctorData()` | user + personal_data + contact_data + md_settings → Recetario doctor |
| `mapPatientData()` | patient + personal_data + contact_data + prepaga → Recetario patient |
| `sanitizeDocumentNumber()` | strip dots, dashes, spaces |
| `mapGender()` | 'male'→'m', 'female'→'f', 'other'→'o' |
| `formatBirthDate()` | ensure YYYY-MM-DD |

### 1.4 Webhook Handler

Register as Express middleware in [middleware/index.ts](apps/api/src/middleware/index.ts) (bypasses FeathersJS JWT auth):

```
POST /webhooks/recetario
```

- HMAC-SHA256 verification: `{X-Timestamp}.{X-Request-Id}.{rawBody}`
- `medical-documents.created` → update prescription status to "completed", store document IDs/URLs
- `medical-documents.shared` → update sharedVia/sharedTo
- Idempotency via `X-Request-Id`

---

## Phase 2: Doctor Profile Enrichment

**Extend profile form** ([profile-form.tsx](apps/ui/app/components/profile-form.tsx)):
- Title select (Dr/Dra) — new field in Professional Info section
- Prescribing Province select (reuse existing province options)
- Signature image upload with preview (separate from P12 certificate)

**Update profile service** ([profile.class.ts](apps/api/src/services/profile/profile.class.ts)):
- Include `recetarioTitle`, `recetarioProvince`, `signatureImage` in md_settings patch

**Readiness indicator** — before allowing prescribe, call `check-readiness` to show missing fields.

**Doctor registration** — when all fields are filled, auto-register the doctor in Recetario via `POST /users` and store `recetarioUserId`.

**i18n** — add `recetario.*` keys to [en.ts](apps/ui/app/i18n/locales/en.ts) and [es.ts](apps/ui/app/i18n/locales/es.ts).

---

## Phase 3: Frontend — Prescribe Flow

### 3.1 Quick Links Mode (simplest)

**Encounter detail** ([encounters.$patientId._index.tsx](apps/ui/app/routes/encounters.$patientId._index.tsx)):
- Add "Prescribe" / "Order" buttons to toolbar (visible when `isMedic && isVerified && recetarioEnabled`)
- Click → `POST /recetario { action: 'quick-link', patientId, encounterId }` → opens Recetario in new tab
- Notification: "Prescription link opened. Valid for 20 minutes."

### 3.2 Full API Mode (richer experience)

**Prescription form component** — dialog/drawer with:
- Medication search (search Recetario's `/medications` vademecum)
- Diagnosis field (can pre-fill from encounter ICD-10 data)
- Quantity, posology, long-term treatment, generic-only, brand recommendation toggles
- Recurring prescription options (30/60/90 days, up to 11 recurrences)
- HIV flag
- Submit → `POST /recetario { action: 'prescribe', ... }`

**Order form component** — dialog/drawer with:
- Free-text order content (studies, certificates, etc.)
- Diagnosis field
- Submit → `POST /recetario { action: 'order', ... }`

### 3.3 Prescription History

**New component: `PrescriptionHistory`** — shown in encounter sidebar or as tab:
- Queries `GET /prescriptions?patientId=xxx`
- Shows: date, type (prescription/order), status, medications, Recetario PDF link
- Actions: Cancel, Share (WhatsApp/email)

### 3.4 Org Settings

**Organization settings page** ([profile-organization.tsx](apps/ui/app/components/profile-organization.tsx) or similar):
- Toggle: "Enable Recetario e-prescriptions"
- Health Center ID input (or "Register" button)

---

## Phase 4: Insurance Mapping + Polish

**Insurance mapping script** — one-time admin task:
1. Fetch Recetario `/health-insurances`
2. Fuzzy match against MedApp `prepagas.denomination`
3. Set `recetarioHealthInsuranceName` on matches
4. Log unmatched for manual review

**Province mapping** — static map from ISO 3166-2:AR codes to display names (should match Recetario's `/provinces`).

---

## Implementation Order

1. `recetario-client.ts` — HTTP wrapper (foundation for everything)
2. `data-mapper.ts` — data transformation functions
3. `prescriptions` model + CRUD service
4. `md_settings` model extensions (3 new columns)
5. `prepagas` model extension (1 new column)
6. `recetario` service with `quick-link` + `check-readiness` actions
7. Profile form extensions (title, province, signature)
8. "Prescribe" button on encounter detail (quick-link mode)
9. Webhook handler in middleware
10. Full API actions (`prescribe`, `order`, `cancel`, `share`)
11. Prescription form + order form UI components
12. Prescription history component
13. Organization settings (Recetario toggle + health center)
14. Insurance mapping script
15. Doctor registration flow (`register-user` action)

---

## Key Files to Modify

| File | Change |
|---|---|
| [apps/api/src/models/md-settings.model.ts](apps/api/src/models/md-settings.model.ts) | Add recetarioTitle, recetarioProvince, signatureImage, recetarioUserId |
| [apps/api/src/models/prepagas.model.ts](apps/api/src/models/prepagas.model.ts) | Add recetarioHealthInsuranceName |
| [apps/api/src/services/index.ts](apps/api/src/services/index.ts) | Register new services |
| [apps/api/src/middleware/index.ts](apps/api/src/middleware/index.ts) | Add webhook handler |
| [apps/api/src/services/profile/profile.class.ts](apps/api/src/services/profile/profile.class.ts) | Include new md_settings fields |
| [apps/ui/app/components/profile-form.tsx](apps/ui/app/components/profile-form.tsx) | Add title/province/signature fields |
| [apps/ui/app/routes/encounters.$patientId._index.tsx](apps/ui/app/routes/encounters.$patientId._index.tsx) | Add prescribe button + quick-link flow |
| [apps/ui/app/i18n/locales/en.ts](apps/ui/app/i18n/locales/en.ts) | Add recetario translations |
| [apps/ui/app/i18n/locales/es.ts](apps/ui/app/i18n/locales/es.ts) | Add recetario translations |
| [apps/api/config/default.json](apps/api/config/default.json) | Add recetario config section |

## New Files to Create

| File | Purpose |
|---|---|
| `apps/api/src/services/recetario/recetario-client.ts` | HTTP wrapper for Recetario API |
| `apps/api/src/services/recetario/data-mapper.ts` | MedApp → Recetario data transforms |
| `apps/api/src/services/recetario/recetario.class.ts` | Main service with action dispatcher |
| `apps/api/src/services/recetario/recetario.hooks.ts` | Auth + org hooks |
| `apps/api/src/services/recetario/recetario.service.ts` | Service registration |
| `apps/api/src/services/prescriptions/prescriptions.class.ts` | Sequelize CRUD |
| `apps/api/src/services/prescriptions/prescriptions.hooks.ts` | Hooks |
| `apps/api/src/services/prescriptions/prescriptions.service.ts` | Registration |
| `apps/api/src/models/prescriptions.model.ts` | DB model |
| `apps/api/src/middleware/recetario-webhook-handler.ts` | Webhook processing |
| `apps/ui/app/components/prescription-form.tsx` | Prescription creation UI |
| `apps/ui/app/components/order-form.tsx` | Order creation UI |
| `apps/ui/app/components/prescription-history.tsx` | History display |

---

## Verification

1. **Readiness check**: Fill doctor profile → `check-readiness` returns `ready: true`
2. **Quick link**: Generate quick-link for test patient → verify URL opens Recetario with correct data
3. **Full API prescribe**: Create prescription via API → verify it appears in `GET /medical-documents`
4. **Full API order**: Create order → verify PDF URL returned
5. **Cancel**: Cancel a prescription → verify it's marked cancelled
6. **Webhook**: Use Recetario staging (doctor with @recetario.com.ar email) → complete prescription → verify webhook updates local record
7. **Share**: Share prescription via email → verify webhook fires
8. **History**: Verify prescriptions appear in the sidebar history component
9. **Insurance mapping**: Run mapping script → verify prepagas have `recetarioHealthInsuranceName` set

---

---

## Future: Ley 27.706 — Electronic Health Records Interoperability

> **Not in scope for this implementation.** No hard compliance deadlines yet ("progressive implementation"). Noted here for awareness.

[Ley 27.706](https://www.boletinoficial.gob.ar/detalleAviso/primera/282707/20230316) (regulated by [Decreto 393/2023](https://servicios.infoleg.gob.ar/infolegInternet/anexos/385000-389999/387475/norma.htm)) creates a unified national electronic health records system. Unlike ReNaPDiS (prescriptions only), this affects **medical records, encounters, and studies**.

### What it will eventually require:

- **Registration** with the "Registro de Dominios de Interoperabilidad en Salud"
- **Interoperability** with the Red Nacional de Interoperabilidad en Salud (standardized clinical terminologies, communication protocols)
- **Audit trails** for all system interactions and data modifications
- **Digital signatures** per Ley 25.506 on clinical records
- **Patient portal access** — patients must be able to view their records
- **Authentication coordination** with RENAPER, professional colleges, health authorities
- **Data protection** per Ley 25.326 (Habeas Data) and patient rights per Ley 26.529
- Private practitioners explicitly included — must make records available to the unified system

### What MedApp already has covered:
- Encryption at rest (AES-256)
- Digital PDF signing with P12 certificates
- Role-based access control + org scoping
- 2FA + WebAuthn
- Audit logging (Winston)

### Gaps to address when deadlines are set:
- Interoperability exports (HL7 FHIR or whatever standard is mandated)
- Patient-facing portal for record access
- RENAPER authentication integration
- Registration with the national interoperability registry
- Standardized clinical terminology (SNOMED CT likely)

---

## Regulatory Sources

- [ReNaPDiS Official](https://www.argentina.gob.ar/salud/digital/renapdis)
- [Resolución 1959/2024](https://www.boletinoficial.gob.ar/detalleAviso/primera/309638/20240626)
- [Decreto 345/2024](https://www.boletinoficial.gob.ar/detalleAviso/primera/306098/20240422)
- [Disposición 1/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/328812/20250724)
- [Ley 27.706](https://www.boletinoficial.gob.ar/detalleAviso/primera/282707/20230316)
- [Decreto 393/2023](https://servicios.infoleg.gob.ar/infolegInternet/anexos/385000-389999/387475/norma.htm)
- [Red Nacional de Salud Digital](https://www.argentina.gob.ar/salud/digital/red)
- [Historia Clínica Electrónica - Ley Simple](https://www.argentina.gob.ar/justicia/derechofacil/leysimple/salud/historia-clinica-electronica)
- [Recetario Docs](Recetario%20Docs.md)
