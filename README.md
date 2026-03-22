# ClawView

ClawView is a mobile-first transparency console for OpenClaw. It turns agent status, task progress, costs, memory, and alerts into a phone-friendly control panel.

## What It Does

- shows whether OpenClaw is online and what it is doing
- turns transcripts into readable task flow
- shows token and cost changes
- lets users inspect local memory files
- works on desktop and mobile browsers

## One-Line Install

For most users, this is the command to run:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash
```

If the user already knows their OpenClaw directory:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash -s -- ~/.openclaw
```

This installer will:

- clone or update `clawview` into `~/clawview`
- create `.env` automatically
- detect OpenClaw and `clawd` paths
- prefer Docker when available
- fall back to local mode when Docker is unavailable

## Let OpenClaw Deploy It

If the user prefers to ask OpenClaw directly, they can send:

```text
请在终端执行这条命令并完成 ClawView 安装：curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash
```

## Open on Phone

ClawView does not need a separate app. Open it in the phone browser.

Same Wi-Fi:

- Docker mode: `http://电脑局域网IP:3000`
- Local mode: `http://电脑局域网IP:5173`

Example:

- `http://192.168.1.23:3000`

## Open From Another Network

Recommended option: Tailscale.

Private access inside your own tailnet:

```bash
./scripts/share-clawview.sh tailnet
```

Public HTTPS link:

```bash
./scripts/share-clawview.sh public
```

## Smoke Check

Before going live, run:

```bash
./scripts/smoke-check.sh
```

It checks:

- `.env` loading
- OpenClaw and `clawd` paths
- transcript and memory artifacts
- Docker or local runtime readiness
- optional health endpoints if services are already running

## Manual Start

Docker:

```bash
docker compose up --build -d
```

Local:

```bash
./scripts/launch-local-clawview.sh
```

## Docs

- Deployment guide: [docs/DEPLOYMENT.md](/Users/liuzichang/Downloads/app/clawview/docs/DEPLOYMENT.md)
- Architecture and design docs: [docs](/Users/liuzichang/Downloads/app/clawview/docs)

## Stack

- React 19 + Vite
- Hono + TypeScript
- pnpm workspace
- Docker Compose or local runtime
