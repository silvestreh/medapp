# MedApp API Documentation

> FeathersJS REST + WebSocket API for managing medical appointments, patient records, and healthcare organizations.

## Table of Contents

| Document | Description |
|---|---|
| [Architecture](./architecture.md) | High-level overview of the system design, directory structure, and request lifecycle |
| [Authentication & Authorization](./authentication.md) | JWT, local login, 2FA, WebAuthn/passkeys, RBAC, and organization scoping |
| [API Reference](./api-reference.md) | All service endpoints with methods, parameters, and examples |
| [Database & Encryption](./database.md) | Sequelize models, encryption strategies, and full-text search |
| [Configuration](./configuration.md) | Environment variables, config files, and deployment settings |
| [Development Guide](./development.md) | Local setup, scripts, testing, debugging, and deployment |

## Quick Start

```bash
# From monorepo root
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit .env — at minimum set ENCRYPTION_KEY

# Initialize database
pnpm --filter medapp-api db:init

# Start dev server
pnpm --filter medapp-api dev
# → http://localhost:3030
```

## Tech Stack

- **Runtime:** Node.js >= 18
- **Framework:** FeathersJS v4 + Express
- **Language:** TypeScript
- **Database:** PostgreSQL + Sequelize ORM
- **Auth:** JWT, bcrypt, TOTP 2FA, WebAuthn passkeys
- **Encryption:** pgcrypto (PGP_SYM_ENCRYPT / PGP_SYM_DECRYPT)
- **Email:** Mailgun
- **Monitoring:** Sentry
- **Deployment:** Railway
