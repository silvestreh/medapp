# Configuration

## Config Files

The app uses `@feathersjs/configuration` to load JSON files from `config/` based on `NODE_ENV`:

| File | Loaded when |
|---|---|
| `config/default.json` | Always (base config) |
| `config/production.json` | `NODE_ENV=production` (merged on top of default) |
| `config/test.json` | `NODE_ENV=test` (merged on top of default) |

In `production.json`, string values like `"HOST"` or `"DB_URL"` are resolved from environment variables of the same name.

## Environment Variables

### Required

| Variable | Description | Example |
|---|---|---|
| `ENCRYPTION_KEY` | 32-byte base64 key for pgcrypto | `openssl rand -base64 32` |

### Server

| Variable | Description | Default |
|---|---|---|
| `HOST` | Bind address | `localhost` |
| `PORT` | Server port | `3030` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `*` |

### Database

| Variable | Description | Default |
|---|---|---|
| `DB_URL` | PostgreSQL connection string (production) | `postgres://postgres:@localhost:5432/medapp_api` |

In development, the connection string comes from `config/default.json`. In production, it's read from the `DB_URL` environment variable.

### Authentication

| Variable | Description | Default |
|---|---|---|
| `AUTH_SECRET` | JWT signing secret | Defaults from `config/default.json` |
| `AUTH_RATE_LIMIT_MAX` | Max login attempts per minute per IP | `10` |

### WebAuthn

| Variable | Description | Default |
|---|---|---|
| `WEBAUTHN_RP_ID` | Domain users visit (UI domain) | `localhost` |
| `WEBAUTHN_RP_NAME` | Display name in passkey prompts | `MedApp` |
| `WEBAUTHN_ORIGIN` | Full origin with protocol | `http://localhost:5173` |

`WEBAUTHN_RP_ID` must match the UI domain, not the API domain. If UI and API are on different subdomains (e.g., `app.example.com` and `api.example.com`), set it to the common parent (`example.com`).

### Email (Mailgun)

| Variable | Description |
|---|---|
| `MAILGUN_API_KEY` | Mailgun API key |
| `MAILGUN_DOMAIN` | Mailgun sending domain |
| `MAILGUN_FROM` | From address (e.g., `MedApp <noreply@example.com>`) |

### Monitoring

| Variable | Description |
|---|---|
| `SENTRY_DSN` | Sentry DSN for error reporting (omit to disable) |

### Optional

| Variable | Description | Default |
|---|---|---|
| `DEBUG` | Set to `true` for verbose service method logging | `false` |
| `TOTP_ISSUER` | Issuer label shown in authenticator apps | `MedApp` |

## Default Settings

From `config/default.json`:

```json
{
  "host": "localhost",
  "port": 3030,
  "paginate": {
    "default": 10,
    "max": 50
  },
  "authentication": {
    "entity": "user",
    "service": "users",
    "authStrategies": ["jwt", "local"],
    "jwtOptions": {
      "algorithm": "HS256",
      "expiresIn": "1d"
    },
    "local": {
      "usernameField": "username",
      "passwordField": "password"
    }
  }
}
```

## Security Headers

Helmet is configured with a strict Content-Security-Policy:

```
default-src: 'self'
script-src: 'self' 'unsafe-inline'
style-src: 'self' 'unsafe-inline'
img-src: 'self' data: blob:
connect-src: 'self'
font-src: 'self'
object-src: 'none'
frame-ancestors: 'none'
```

## Query Parser

The default `qs` query parser is configured with `arrayLimit: 500` to support large array parameters in Sequelize `$in` queries. The default `qs` limit of 20 silently converts arrays with more than 20 elements into objects, which breaks query behavior.
