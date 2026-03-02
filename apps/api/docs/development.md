# Development Guide

## Prerequisites

- Node.js >= 18
- PostgreSQL (running locally or via Docker)
- pnpm

## Local Setup

```bash
# 1. Install dependencies (from monorepo root)
pnpm install

# 2. Create .env in apps/api/
cp apps/api/.env.example apps/api/.env
# Edit .env — set at minimum:
#   ENCRYPTION_KEY=<output of: openssl rand -base64 32>

# 3. Initialize database (creates DB, tables, seeds)
pnpm --filter medapp-api db:init

# 4. Start dev server with hot reload
pnpm --filter medapp-api dev
# → http://localhost:3030
```

## Scripts

Run from the monorepo root with `pnpm --filter medapp-api <script>` or from `apps/api/` directly.

### Development

| Script | Description |
|---|---|
| `dev` | Start dev server with ts-node-dev (hot reload) |
| `build` | Compile TypeScript to `lib/` |
| `start` | Run compiled output (`node lib/`) |
| `lint` | Run ESLint with auto-fix |

### Database

| Script | Description |
|---|---|
| `db:init` | Create database, sync tables, seed reference data |
| `db:reset` | Drop and recreate all tables (destructive) |
| `db:drop` | Drop the database entirely (destructive) |
| `db:create-seeds` | Generate seed data files |
| `db:import-seeds` | Import seed data from files |
| `db:import-time-off` | Import doctor time-off schedules |
| `db:seed-test-org` | Create a test organization with sample data |

### Testing

| Script | Description |
|---|---|
| `test` | Lint + compile + run Mocha tests |
| `mocha` | Run Mocha tests only (with NYC coverage) |
| `coverage` | Generate lcov coverage report |

The `pretest` script automatically runs `db:reset` to ensure a clean database state before tests.

## Testing

Tests use Mocha with NYC for code coverage. Test files live in `test/`.

```bash
# Run full test suite (lint, compile, test)
pnpm --filter medapp-api test

# Run tests only
pnpm --filter medapp-api mocha

# Generate coverage report
pnpm --filter medapp-api coverage
```

Configuration files:
- `.mocharc.json` — Mocha settings
- `.nycrc.json` — NYC coverage settings

## Debugging

### Verbose Logging

Set `DEBUG=true` in your `.env` to log all service method calls:

```
[BEFORE] patients:find
query = { "$limit": 10 }
[AFTER] patients:find
result = { "total": 3, "data": [...] }
```

This logs to stdout via the global hooks in `src/app.hooks.ts`.

### Winston Logger

The application uses Winston for structured logging (`src/logger.ts`). Cron jobs and database operations use this logger.

### Sentry

When `SENTRY_DSN` is set, errors are reported to Sentry at three levels:

1. Express middleware errors (`Sentry.setupExpressErrorHandler()` in `app.ts`)
2. FeathersJS service errors (global `error.all` hook in `app.hooks.ts`)
3. Unhandled promise rejections (in `index.ts`)

401 errors are excluded from Sentry reporting since they're expected from failed authentication.

## Adding a New Service

1. Create the model in `src/models/<name>.model.ts`:
   ```typescript
   import { makeDefine } from '../sequelize';
   // ...
   export default function (app: Application): void {
     const sequelize = app.get('sequelizeClient');
     const define = makeDefine(sequelize);
     const Model = define('table_name', { /* attributes */ }, {
       encryptedFields: ['sensitiveField'], // optional
     });
     // associations
   }
   ```

2. Create the service directory `src/services/<name>/`:
   - `<name>.service.ts` — Register service and hooks
   - `<name>.class.ts` — Custom class (if needed)

3. Register in `src/services/index.ts`:
   ```typescript
   import myService from './<name>/<name>.service';
   // ...
   app.configure(myService);
   ```

4. Import the model in the model file and ensure it's loaded before the service.

## Adding a New Hook

1. Create the hook in `src/hooks/<name>.ts`:
   ```typescript
   import { Hook, HookContext } from '@feathersjs/feathers';

   export const myHook = (options = {}): Hook => {
     return async (context: HookContext): Promise<HookContext> => {
       // hook logic
       return context;
     };
   };
   ```

2. Apply it in a service's hook configuration or globally in `app.hooks.ts`.

## Deployment

The API deploys to Railway. See [Configuration](./configuration.md) for required environment variables.

**Railway configuration** is in `railway.toml` at the project root.

### Seeding Production Database

To seed the remote database via Railway CLI:

```bash
cd apps/api && railway run bash -c 'DB_URL="<DATABASE_PUBLIC_URL>" ts-node scripts/import-seeds.ts --reset-passwords'
```

Use the public database URL (not internal networking) since the script runs from your local machine.

## Workspace Dependencies

The API depends on two workspace packages:

- `@medapp/encounter-schemas` — Shared schemas for encounter data validation
- `@medapp/translations` — Shared i18n translation strings
