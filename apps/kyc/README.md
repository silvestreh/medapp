# KYC — Identity Verification Service

Standalone identity verification product. Consumers integrate via a Web Component (`<kyc-widget>`) with Shadow DOM isolation — works with any framework.

## Quick Start

```bash
pnpm install
pnpm run build
pnpm run dev
```

Runs on `http://localhost:3032`.

## Integration

### 1. Load the SDK

```html
<script src="https://your-kyc-host.com/widget.js"></script>
```

### 2. Initialize

```html
<div id="kyc"></div>
<script>
  KycWidget.init({
    apiKey: 'pk_live_xxx',
    userId: 'user-123',
    idData: {
      firstName: 'Juan',
      lastName: 'Perez',
      dniNumber: '12345678',
      birthDate: '1990-01-15',
      gender: 'male',
    },
    container: '#kyc',
    locale: 'es',
    onCompleted: (result) => {
      console.log('Verification submitted:', result.sessionId);
    },
    onError: (err) => {
      console.error('Verification error:', err.message);
    },
  });
</script>
```

The `api` URL is auto-detected from the script's origin — no need to specify it unless the script is self-hosted on a different domain.

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | string | yes* | Publishable key (safe for frontend) |
| `token` | string | yes* | JWT token (alternative to apiKey) |
| `userId` | string | yes | User ID in your system |
| `idData` | object | no | User data for DNI cross-validation |
| `container` | string \| HTMLElement | yes | CSS selector or DOM element to mount in |
| `locale` | string | no | `'es'` (default) or `'en'` |
| `callbackUrl` | string | no | Webhook URL for server-to-server notifications |
| `callbackSecret` | string | no | HMAC secret for webhook signatures |
| `onCompleted` | function | no | Called when verification is submitted |
| `onError` | function | no | Called on errors |
| `onReady` | function | no | Called when widget is mounted |

\* One of `apiKey` or `token` is required.

### Events

The `<kyc-widget>` element dispatches these CustomEvents:

| Event | Detail | When |
|-------|--------|------|
| `kyc:ready` | `{ version }` | Widget mounted |
| `kyc:step-completed` | `{ step, uploaded, total }` | Each photo uploaded |
| `kyc:completed` | `{ sessionId }` | All photos submitted |
| `kyc:error` | `{ message, code }` | Error occurred |

## Authentication

### Publishable Key (frontend)

For browser-side integration. Can only create verification sessions.

Set `WIDGET_PUBLISHABLE_KEY` in the KYC service environment. Consumers pass it as `apiKey` in `KycWidget.init()` or as the `x-publishable-key` HTTP header.

### Secret API Key (backend)

For server-to-server calls. Full API access.

Set `WIDGET_API_KEY` in the KYC service environment. Pass as `x-api-key` HTTP header.

### JWT (internal)

For services sharing the same JWT secret (e.g. the medical app). Pass as `token` in `KycWidget.init()` or as `Authorization: Bearer <token>` HTTP header.

### Roadmap

Publishable and secret keys are currently configured via environment variables (one per deployment). In the future, the KYC dashboard will support multi-tenant key management — consumers create an account and generate their own key pairs.

## Webhooks

When a verification status changes, the KYC service sends a POST to:

1. The main API webhook (`mainApiUrl/webhooks/identity-verification`) using the shared `WEBHOOK_SECRET`
2. The session's `callbackUrl` (if configured) with an HMAC-SHA256 signature

Webhook payload:
```json
{
  "event": "verification.verified",
  "verification": {
    "id": "...",
    "userId": "...",
    "status": "verified",
    "dniScanMatch": true,
    "faceMatch": true
  }
}
```

Signature header: `x-kyc-signature: sha256=<hex(hmac(callbackSecret, body))>`

## Architecture

The KYC service serves three client bundles:

- **Mobile page** (`/verify/:token`) — full-screen mobile verification flow, accessed via QR code
- **Widget** (`/widget.js`) — `<kyc-widget>` Web Component with Shadow DOM, embeddable anywhere
- **Admin** (`/admin.js`) — `<kyc-admin>` Web Component for reviewing/approving verifications

All bundles are built with esbuild and use Tailwind CSS scoped inside Shadow DOM.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WIDGET_PUBLISHABLE_KEY` | Frontend-safe key for `KycWidget.init()` |
| `WIDGET_API_KEY` | Secret key for server-to-server API calls |
| `WEBHOOK_SECRET` | Shared secret for main API webhook |
| `FACE_COMPARE_API_URL` | URL of the face-compare microservice |
| `FACE_COMPARE_API_KEY` | API key for face-compare service |
| `KYC_BASE_URL` | Public URL of this KYC service (for callbacks) |
| `CORS_ORIGIN` | Comma-separated allowed origins |
