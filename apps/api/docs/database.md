# Database & Encryption

## Overview

The API uses PostgreSQL with Sequelize ORM. Database models are defined in `src/models/` and registered automatically on app startup. The database is synced via `sequelize.sync({ alter: true })` in non-production environments; production requires manual migration management.

## Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    users     │────▶│ user_personal_   │────▶│  personal_data  │
│              │     │ data             │     │  (encrypted)    │
│  username    │     └──────────────────┘     │  firstName      │
│  password    │                              │  lastName       │
│  isSuperAdmin│     ┌──────────────────┐     │  documentValue  │
│  twoFactor*  │────▶│ user_contact_    │──┐  │  birthDate      │
└──────┬───────┘     │ data             │  │  │  nationality    │
       │             └──────────────────┘  │  └─────────────────┘
       │                                   │
       │  ┌──────────────────┐             │  ┌─────────────────┐
       ├─▶│ organization_    │             └─▶│  contact_data   │
       │  │ users            │                │  (encrypted)    │
       │  └────────┬─────────┘                │  address        │
       │           │                          │  phone          │
       │           ▼                          │  email          │
       │  ┌──────────────────┐                └─────────────────┘
       │  │ organizations    │
       │  │                  │
       │  │  name, slug      │
       │  │  settings        │
       │  │  isActive        │
       │  └────────┬─────────┘
       │           │
       │           │  ┌──────────────────┐
       │           └─▶│ organization_    │
       │              │ patients         │
       │              └────────┬─────────┘
       │                       │
       │              ┌────────▼─────────┐     ┌─────────────────┐
       │              │    patients      │────▶│ patient_personal │
       │              │                  │     │ _data           │──▶ personal_data
       │              │  insurerName     │     └─────────────────┘
       │              │  insurerNumber   │
       │              │  mugshot         │     ┌─────────────────┐
       │              └────────┬─────────┘────▶│ patient_contact │
       │                       │               │ _data           │──▶ contact_data
       │                       │               └─────────────────┘
       │              ┌────────▼─────────┐
       ├─────────────▶│  appointments    │
       │              │  date, duration  │
       │              │  status          │
       │              └──────────────────┘
       │
       │              ┌──────────────────┐
       ├─────────────▶│   encounters     │
       │              │  data (encrypted)│
       │              │  patientId       │
       │              └──────────────────┘
       │
       │              ┌──────────────────┐
       ├─────────────▶│   md_settings    │
       │              │  license, hours  │
       │              │  specialty       │
       │              └──────────────────┘
       │
       │              ┌──────────────────┐     ┌──────────────────┐
       └─────────────▶│   user_roles     │────▶│     roles        │
                      └──────────────────┘     │  name            │
                                               │  permissions[]   │
                                               └──────────────────┘
```

Additional tables: `studies`, `study_results`, `icd_10`, `laboratories`, `medications`, `prepagas`, `time_off_events`, `invites`, `passkey_credentials`, `signing_certificates`, `encounter_ai_chat`, `encounter_ai_chat_messages`, `llm_provider_keys`, `llm_models`, `accounting`, `accounting_settings`, `referring_doctors`.

## Models

Models are defined in `src/models/` using the `makeDefine()` helper from `src/sequelize.ts`, which wraps Sequelize's `define()` to add automatic encryption hooks.

### Key Models

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| username | STRING | Unique, normalized to lowercase |
| password | STRING | bcrypt hash |
| isSuperAdmin | BOOLEAN | Cannot be set via API |
| twoFactorEnabled | BOOLEAN | |
| twoFactorSecret | STRING | TOTP secret (encrypted) |

**personal_data** (encrypted fields)
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| firstName | STRING | Encrypted |
| lastName | STRING | Encrypted |
| documentType | STRING | Encrypted |
| documentValue | STRING | Encrypted |
| birthDate | STRING | Encrypted |
| nationality | STRING | Encrypted |
| biologicalSex | STRING | Encrypted |
| searchFirstName | TEXT | Generated column (unaccented lowercase) |
| searchLastName | TEXT | Generated column (unaccented lowercase) |

**encounters**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| data | TEXT | Non-deterministic encrypted (PGP_SYM_ENCRYPT) |
| patientId | UUID | FK to patients |
| medicId | UUID | FK to users |
| organizationId | UUID | FK to organizations |

**organizations**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | STRING | |
| slug | STRING | Unique URL identifier |
| settings | JSONB | Org-level configuration |
| isActive | BOOLEAN | |

## Encryption

Two encryption strategies are used, both powered by PostgreSQL's `pgcrypto` extension.

### Non-Deterministic Encryption

Used for maximum-security fields where querying is not needed (e.g., `encounters.data`).

- **Encrypt:** `PGP_SYM_ENCRYPT(value, key)`
- **Decrypt:** `PGP_SYM_DECRYPT(value::bytea, key)`
- Same plaintext produces different ciphertext each time
- Cannot be indexed or used in WHERE clauses

### Deterministic Encryption

Used for fields that need to be searchable (e.g., `personal_data.documentValue`).

- Uses the same `PGP_SYM_ENCRYPT` but the hook system manages encrypt/decrypt transparently
- Fields listed in `encryptedFields` in the model definition are auto-encrypted on write and decrypted on read
- The `includeDecryptedAttributes` hook adds `PGP_SYM_DECRYPT` calls to SELECT queries

### How It Works

The `makeDefine()` function in `src/sequelize.ts`:

1. Accepts an `encryptedFields` array in model options
2. Registers `beforeCreate`, `beforeUpdate`, and `beforeBulkUpdate` hooks to encrypt specified fields
3. Generates a `decryptedAttributes` array that replaces encrypted columns with `PGP_SYM_DECRYPT()` calls in queries
4. Service hooks use `decryptedAttributes` in `attributes` option when running find/get queries

### Key Management

- The encryption key is set via the `ENCRYPTION_KEY` environment variable
- Generate with: `openssl rand -base64 32`
- The same key encrypts all fields — losing it means losing access to all encrypted data
- Key rotation is not built in; changing the key requires re-encrypting all data

## Full-Text Search

PostgreSQL generated columns and trigram indexes enable fuzzy name search:

```sql
-- Generated columns (auto-computed from encrypted fields after decryption)
"searchFirstName" text GENERATED ALWAYS AS (immutable_unaccent(lower("firstName"))) STORED
"searchLastName" text GENERATED ALWAYS AS (immutable_unaccent(lower("lastName"))) STORED
"searchText" text GENERATED ALWAYS AS (immutable_unaccent(lower("commercialNamePresentation" || ' ' || "genericDrug"))) STORED

-- Trigram indexes for fuzzy matching
CREATE INDEX personal_data_search_first_name_idx ON "personal_data" USING gin ("searchFirstName" gin_trgm_ops);
CREATE INDEX personal_data_search_last_name_idx ON "personal_data" USING gin ("searchLastName" gin_trgm_ops);
CREATE INDEX medications_search_text_idx ON "medications" USING gin ("searchText" gin_trgm_ops);
```

The `findByPersonalData` hook uses these indexes for patient name searches, supporting accent-insensitive, case-insensitive fuzzy matching.

## Database Sync

- **Development:** `sequelize.sync({ alter: true })` — automatically adjusts tables to match models
- **Production:** `alter` is disabled — schema changes must be managed manually
- Generated columns are dropped before sync and re-created after to avoid conflicts with `alter`
- The `pgcrypto`, `unaccent`, and `pg_trgm` extensions are created automatically on startup
