# ClawView

ClawView is a mobile-first transparency console for OpenClaw. It turns agent status, task progress, costs, memory, and alerts into a phone-friendly control panel.

## Let OpenClaw Install It

Send this prompt to OpenClaw first:

```text
请在终端执行这条命令并完成 ClawView 安装：curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash

安装完成后，请继续输出一份简短结果说明，至少包含：
1. 是否安装成功
2. 当前使用的是 Docker 模式还是本机模式
3. 电脑端打开地址
4. 手机端打开地址（同一 Wi-Fi 下）
5. 如何再次启动 / 停止
6. 主要功能说明
7. 使用时的注意事项或排查建议
```

If the user already knows their OpenClaw directory, they can ask OpenClaw to run:

```text
请在终端执行这条命令并完成 ClawView 安装：curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash -s -- ~/.openclaw

安装完成后，请继续输出一份简短结果说明，至少包含：
1. 是否安装成功
2. 当前使用的是 Docker 模式还是本机模式
3. 电脑端打开地址
4. 手机端打开地址（同一 Wi-Fi 下）
5. 如何再次启动 / 停止
6. 主要功能说明
7. 使用时的注意事项或排查建议
```

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
