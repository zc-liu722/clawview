FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY packages/shared packages/shared

EXPOSE 8787

CMD ["pnpm", "--filter", "@clawview/server", "exec", "tsx", "src/index.ts"]
