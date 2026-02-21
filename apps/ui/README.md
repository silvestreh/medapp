# MedApp UI

> A Remix application for managing medical appointments, patient records, and clinical encounters.

Built with [Remix](https://remix.run), [Mantine](https://mantine.dev), [PandaCSS](https://panda-css.com), and [Sentry](https://sentry.io) for error tracking.

## Prerequisites

- Node.js >= 20
- pnpm
- The [MedApp API](../api/README.md) running locally or accessible via URL

## Setup

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in `apps/ui/`:

```bash
# Required
SESSION_SECRET=       # Secret for encrypting session cookies (any random string)
API_URL=              # URL of the MedApp API (default: http://localhost:3030)

# Error Reporting
VITE_SENTRY_DSN=      # Sentry DSN for error reporting (omit to disable)
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

### 3. Generate PandaCSS tokens

```bash
pnpm --filter medapp-ui prepare
```

### 4. Start the dev server

```bash
pnpm --filter medapp-ui dev
```

The app will be available at `http://localhost:5173`.

## Scripts

| Script              | Description                                        |
|---------------------|----------------------------------------------------|
| `pnpm dev`          | Start the Vite dev server                          |
| `pnpm start`        | Run the production server (requires a build first) |
| `pnpm prepare`      | Generate PandaCSS code                             |
| `pnpm typecheck`    | Run TypeScript type checking                       |
| `pnpm lint`         | Run ESLint with auto-fix                           |
| `pnpm format`       | Format code with Prettier                          |
| `pnpm format:check` | Check formatting without writing                   |

## Architecture

- **`app/routes/`** -- Remix file-based routes handling both loaders (data fetching) and actions (form submissions).
- **`app/components/`** -- Reusable UI components. Medical form components live in `components/forms/`.
- **`app/utils/`** -- Server-side utilities for authentication, API communication, etc.
- **`app/i18n/`** -- Internationalization with English and Spanish locales.
- **`app/routes/api.$.tsx`** -- Catch-all proxy route that forwards `/api/*` requests to the backend API.

## Deploying to Railway

Set these environment variables on your Railway UI service:

| Variable         | Example                                                  |
|------------------|----------------------------------------------------------|
| `SESSION_SECRET` | *(output of `openssl rand -base64 32`)*                  |
| `API_URL`        | `https://api.example.com` (your Railway API service URL) |
| `NODE_ENV`       | `production`                                             |
| `VITE_SENTRY_DSN`| `https://xxx@xxx.ingest.de.sentry.io/xxx`                |

The `railway.toml` in this directory handles build and start commands automatically.

## Error Reporting (Sentry)

The UI reports errors to [Sentry](https://sentry.io) when the `VITE_SENTRY_DSN` environment variable is set. If omitted, Sentry is effectively disabled.

The `VITE_` prefix is required because Vite exposes only `VITE_`-prefixed env vars to client-side code. The same variable is used on the server side as well so you only need to set one value.

Errors are captured at three levels:

- **Client-side** -- via `@sentry/remix` in `entry.client.tsx` (browser tracing, session replay).
- **Server-side** -- via `@sentry/remix` in `instrumentation.server.mjs` (auto-instrumented Remix handlers).
- **Error boundaries** -- via `captureRemixErrorBoundaryError()` in `root.tsx`.

Source maps are uploaded to Sentry during builds via the `sentryVitePlugin` in `vite.config.ts`. This requires a `SENTRY_AUTH_TOKEN` env var (generated from your Sentry account settings).
