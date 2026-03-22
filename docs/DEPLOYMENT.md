# ClawView Deployment Guide

## Recommended Deployment Order

1. Prepare your OpenClaw paths.
2. Run the smoke check.
3. Start ClawView with Docker or local mode.
4. Open the web URL on your computer.
5. Open the same URL from your phone over the LAN or through Tailscale.

## One-Line GitHub Install

After you publish this repo to GitHub, end users can install ClawView with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash
```

If they already know their OpenClaw path:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash -s -- ~/.openclaw
```

For non-interactive shells:

```bash
curl -fsSL https://raw.githubusercontent.com/zc-liu722/clawview/main/scripts/install-from-github.sh | CLAWVIEW_NON_INTERACTIVE=1 CLAWVIEW_REPO_URL=https://github.com/zc-liu722/clawview.git bash
```

What it does:

- clones or updates the repo into `~/clawview`
- creates `.env` if missing
- forwards into `scripts/bootstrap-clawview.sh`
- prefers Docker and falls back to local mode

## 1. Prepare Paths

You need these two directories:

- `CLAWVIEW_OPENCLAW_HOME`: your OpenClaw data directory
- `CLAWVIEW_CLAWD_DIR`: your writable memory directory

Typical examples:

- macOS/Linux OpenClaw: `~/.openclaw`
- macOS/Linux clawd: `~/clawd`

Create `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set absolute paths:

```env
CLAWVIEW_OPENCLAW_HOME=/absolute/path/to/your/.openclaw
CLAWVIEW_CLAWD_DIR=/absolute/path/to/your/clawd
CLAWVIEW_WEB_PORT=3000
CLAWVIEW_LOCAL_PORT=5173
```

Port meanings:

- `CLAWVIEW_WEB_PORT`: Docker mode browser port
- `CLAWVIEW_LOCAL_PORT`: local bundled mode browser port
- `CLAWVIEW_PORT`: internal API/server port

If your OpenClaw CLI is not on `PATH`, also set:

```env
CLAWVIEW_OPENCLAW_BIN=/absolute/path/to/openclaw
```

If you deploy with Docker and do not need CLI-triggered gateway/message actions inside the container, leave:

```env
CLAWVIEW_ENABLE_OPENCLAW_CLI=false
```

If you run local mode and want gateway restart, usage-cost, and outbound message features, set:

```env
CLAWVIEW_ENABLE_OPENCLAW_CLI=true
```

If your gateway commands are custom, also set:

```env
CLAWVIEW_GATEWAY_RESTART_COMMAND=/absolute/path/to/openclaw gateway restart
CLAWVIEW_GATEWAY_USAGE_COMMAND=/absolute/path/to/openclaw gateway usage-cost --json --days 30
```

## 2. Run Smoke Check

Auto mode:

```bash
./scripts/smoke-check.sh
```

Docker-only check:

```bash
./scripts/smoke-check.sh --mode docker
```

Local-only check:

```bash
./scripts/smoke-check.sh --mode local
```

What you want to see:

- OpenClaw and clawd directories are found
- transcript/session artifacts are detected
- no `FAIL` lines

Warnings are allowed, but review them before go-live.

## 3. Deploy

### Option A: Docker Compose

Use this when Docker is already installed and running.

```bash
docker compose up --build -d
```

Open:

- `http://localhost:3000`

Stop:

```bash
docker compose down
```

### Option B: Local Mode

Use this when Docker is unavailable.

```bash
./scripts/launch-local-clawview.sh
```

Non-interactive local start:

```bash
CLAWVIEW_NON_INTERACTIVE=1 ./scripts/launch-local-clawview.sh --non-interactive ~/.openclaw
```

Open:

- `http://localhost:${CLAWVIEW_LOCAL_PORT:-5173}`

The local launcher will try to install Node.js with the package manager available on the machine.

## 4. Verify on the Computer

Server health:

```bash
curl http://localhost:8787/api/v1/health
```

If Docker mode is running:

- open `http://localhost:3000`

If local mode is running:

- open `http://localhost:5173`

## 5. Open on a Phone

Your phone and computer must be on the same local network.

Find your computer LAN IP:

```bash
ipconfig getifaddr en0
```

Or on Linux:

```bash
hostname -I
```

Then open this on the phone browser:

- Docker mode: `http://YOUR_COMPUTER_IP:3000`
- Local mode: `http://YOUR_COMPUTER_IP:5173`

Example:

- `http://192.168.1.23:3000`

## 6. Open on a Phone From Anywhere

### Recommended: Tailscale Tailnet

This is the safest default if access is only for the user and their own devices.

1. Install Tailscale on the computer and phone.
2. Log both devices into the same tailnet.
3. Start ClawView.
4. Run:

```bash
./scripts/share-clawview.sh tailnet
```

Then open the HTTPS URL shown by Tailscale on the phone.

### Public Link: Tailscale Funnel

If the phone should open ClawView without installing Tailscale, use:

```bash
./scripts/share-clawview.sh public
```

This exposes ClawView on a public HTTPS URL managed by Tailscale Funnel.

### Notes

- `tailnet` mode is private and recommended by default
- `public` mode is easier for sharing, but it is internet-exposed
- use Docker mode on port `3000` when possible
- if you run local mode, the script auto-detects port `5173`

## Mobile Access Checklist

- Computer and phone are on the same Wi-Fi
- Firewall allows inbound access to the chosen port
- Docker mode uses port `3000`
- Local mode uses port `5173`
- The app opens on the computer first

## Common Problems

### The phone cannot open the page

Check:

- the URL uses the computer LAN IP instead of `localhost`
- the machine firewall allows port `3000` or `5173`
- Docker/local service is already running

### The phone is on another network

Check:

- both devices are signed in to Tailscale if using `tailnet` mode
- `./scripts/share-clawview.sh public` was used if the phone is outside the tailnet
- the Tailscale command completed without errors

### Memory can be viewed but not written back

Check:

- `CLAWVIEW_CLAWD_DIR` points to the writable memory directory
- the process has write permission to that directory

### Costs or gateway controls are empty

Check:

- `CLAWVIEW_OPENCLAW_BIN` points to the correct CLI
- `CLAWVIEW_OPENCLAW_LOG_DIR` is set if logs are not in the default location
- custom gateway commands are configured if your installation differs
