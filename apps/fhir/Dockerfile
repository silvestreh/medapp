FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace packages needed by fhir
COPY packages/encounter-schemas/package.json packages/encounter-schemas/
COPY packages/encryption/package.json packages/encryption/

# Copy fhir app package.json
COPY apps/fhir/package.json apps/fhir/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter athelas-fhir...

# Copy source code
COPY packages/encounter-schemas/ packages/encounter-schemas/
COPY packages/encryption/ packages/encryption/
COPY apps/fhir/ apps/fhir/

# Build workspace dependencies first, then fhir
RUN pnpm --filter @athelas/encounter-schemas build 2>/dev/null || true
RUN pnpm --filter @athelas/encryption build 2>/dev/null || true
RUN pnpm --filter athelas-fhir build

WORKDIR /app/apps/fhir

EXPOSE ${PORT:-3040}

CMD ["node", "lib/index.js"]
