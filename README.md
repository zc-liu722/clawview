# ClawView

ClawView turns OpenClaw into something you can actually watch.

It is a mobile-first transparency console for OpenClaw: live status, task flow, costs, memory, approvals, and alerts in one clean browser UI.

## Why ClawView

- See what OpenClaw is doing right now
- Read task progress as a clear flow instead of raw logs
- Track token and cost changes before they surprise you
- Inspect local memory and approval activity in one place
- Open the same dashboard on desktop or phone

## Install In One Line

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash
```

What the installer does:

- clones or updates `~/clawview`
- creates `.env` if missing
- detects OpenClaw and `clawd` paths
- prefers Docker, then falls back to local mode

If you already know the OpenClaw directory:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash -s -- ~/.openclaw
```

For non-interactive shells:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_NON_INTERACTIVE=1 CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash
```

## Ask OpenClaw To Install It

If you want OpenClaw to do the setup for you, send it this:

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

## Run It

Docker:

```bash
docker compose up --build -d
```

Local:

```bash
./scripts/launch-local-clawview.sh
```

Local non-interactive:

```bash
CLAWVIEW_NON_INTERACTIVE=1 ./scripts/launch-local-clawview.sh --non-interactive ~/.openclaw
```

Default ports:

- Docker web UI: `3000`
- Local web UI: `5173`
- Internal API: `8787`

## Open On Your Phone

No app install needed. Open it in the phone browser on the same Wi-Fi:

- Docker mode: `http://YOUR_LAN_IP:3000`
- Local mode: `http://YOUR_LAN_IP:5173`

Example:

- `http://192.168.1.23:3000`

For remote access:

```bash
./scripts/share-clawview.sh tailnet
```

## Health Check

Before going live:

```bash
./scripts/smoke-check.sh
```

It verifies config, paths, runtime readiness, and health endpoints when available.

## Docs

- [Deployment guide](docs/DEPLOYMENT.md)
- [Project docs](docs)

## Stack

React 19, Vite, Hono, TypeScript, pnpm workspace, Docker Compose or local runtime.
