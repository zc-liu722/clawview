#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"
COREPACK_HOME="${ROOT_DIR}/.corepack"
SERVER_LOG="${ROOT_DIR}/.clawview-server.log"
SERVER_PID_FILE="${ROOT_DIR}/.clawview-server.pid"
DEFAULT_OPENCLAW_HOME="${HOME}/.openclaw"
SERVER_ENTRY=""
NON_INTERACTIVE="${CLAWVIEW_NON_INTERACTIVE:-0}"
OPENCLAW_HOME_INPUT="${CLAWVIEW_OPENCLAW_HOME:-}"

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

current_platform() {
  lower "$(uname -s)"
}

print_step() {
  printf '\n==> %s\n' "$1"
}

resolve_path() {
  local path_value="${1:-}"
  if [ -z "${path_value}" ]; then
    return 0
  fi

  case "${path_value}" in
    "~")
      printf '%s\n' "${HOME}"
      ;;
    "~/"*)
      printf '%s/%s\n' "${HOME}" "${path_value#"~/"}"
      ;;
    /*)
      printf '%s\n' "${path_value}"
      ;;
    *)
      printf '%s/%s\n' "${ROOT_DIR}" "${path_value}"
      ;;
  esac
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --non-interactive)
        NON_INTERACTIVE=1
        shift
        ;;
      -h|--help)
        echo "Usage: ./scripts/launch-local-clawview.sh [--non-interactive] [OPENCLAW_HOME]"
        exit 0
        ;;
      *)
        if [ -n "${OPENCLAW_HOME_INPUT}" ] && [ "${OPENCLAW_HOME_INPUT}" != "${CLAWVIEW_OPENCLAW_HOME:-}" ]; then
          echo "不支持多个 OpenClaw 路径参数。"
          exit 1
        fi
        OPENCLAW_HOME_INPUT="$1"
        shift
        ;;
    esac
  done
}

parse_args "$@"

OPENCLAW_HOME="$(resolve_path "${OPENCLAW_HOME_INPUT:-${DEFAULT_OPENCLAW_HOME}}")"

ask_yes_no() {
  local message="$1"
  if [ "${NON_INTERACTIVE}" = "1" ]; then
    return 1
  fi

  if command -v osascript >/dev/null 2>&1 && [ "$(current_platform)" = "darwin" ]; then
    local result
    result="$(osascript -e "button returned of (display dialog \"${message}\" buttons {\"取消\", \"继续\"} default button \"继续\")" 2>/dev/null || true)"
    [ "${result}" = "继续" ]
    return
  fi

  printf '%s [Y/n] ' "${message}"
  read -r reply
  reply="$(lower "${reply:-}")"
  [ -z "${reply}" ] || [ "${reply}" = "y" ] || [ "${reply}" = "yes" ]
}

open_url() {
  local target="$1"

  if command -v open >/dev/null 2>&1; then
    open "${target}" >/dev/null 2>&1 || true
    return
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${target}" >/dev/null 2>&1 || true
    return
  fi

  if command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "${target}" >/dev/null 2>&1 || true
  fi
}

install_node_with_package_manager() {
  if command -v brew >/dev/null 2>&1; then
    brew install node
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm
    return 0
  fi

  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
    return 0
  fi

  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y nodejs npm
    return 0
  fi

  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm nodejs npm
    return 0
  fi

  return 1
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  if [ "${NON_INTERACTIVE}" = "1" ]; then
    echo "本机模式需要 Node.js 20+，当前为非交互模式，未自动安装。请先手动安装 Node.js 后重试。"
    return 1
  fi

  if ! ask_yes_no "本机模式需要 Node.js。现在尝试使用当前系统可用的软件包管理器安装 Node.js 吗？"; then
    return 1
  fi

  print_step "安装 Node.js"
  if install_node_with_package_manager; then
    return 0
  fi

  echo "没有找到可自动安装 Node.js 的包管理器，请先手动安装 Node.js 20+。"
  return 1
}

detect_clawd_dir() {
  local explicit="${CLAWVIEW_CLAWD_DIR:-}"
  local openclaw_home="$1"
  local sibling_clawd

  if [ -n "${explicit}" ]; then
    printf '%s\n' "$(resolve_path "${explicit}")"
    return
  fi

  sibling_clawd="$(cd "${openclaw_home}/.." 2>/dev/null && pwd)/clawd"
  if [ -d "${sibling_clawd}" ]; then
    printf '%s\n' "${sibling_clawd}"
    return
  fi

  if [ -d "${HOME}/clawd" ]; then
    printf '%s\n' "${HOME}/clawd"
    return
  fi

  printf '%s\n' "${openclaw_home}"
}

write_env_file() {
  if [ ! -f "${ENV_FILE}" ]; then
    cp "${EXAMPLE_FILE}" "${ENV_FILE}"
  fi

  local tmp_env
  local clawd_dir
  local local_port="${CLAWVIEW_LOCAL_PORT:-5173}"
  tmp_env="$(mktemp)"
  clawd_dir="$(detect_clawd_dir "${OPENCLAW_HOME}")"

  awk -v openclaw_home="${OPENCLAW_HOME}" -v clawd_dir="${clawd_dir}" -v local_port="${local_port}" '
    BEGIN {
      replaced_openclaw = 0;
      replaced_clawd = 0;
      replaced_source = 0;
      replaced_origin = 0;
      replaced_local_port = 0;
      replaced_cli = 0;
    }
    /^CLAWVIEW_OPENCLAW_HOME=/ {
      print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      replaced_openclaw = 1;
      next;
    }
    /^CLAWVIEW_CLAWD_DIR=/ {
      print "CLAWVIEW_CLAWD_DIR=" clawd_dir;
      replaced_clawd = 1;
      next;
    }
    /^CLAWVIEW_DATA_SOURCE=/ {
      print "CLAWVIEW_DATA_SOURCE=openclaw";
      replaced_source = 1;
      next;
    }
    /^CLAWVIEW_ALLOWED_ORIGIN=/ {
      print "CLAWVIEW_ALLOWED_ORIGIN=http://localhost:" local_port;
      replaced_origin = 1;
      next;
    }
    /^CLAWVIEW_LOCAL_PORT=/ {
      print "CLAWVIEW_LOCAL_PORT=" local_port;
      replaced_local_port = 1;
      next;
    }
    /^CLAWVIEW_ENABLE_OPENCLAW_CLI=/ {
      print "CLAWVIEW_ENABLE_OPENCLAW_CLI=true";
      replaced_cli = 1;
      next;
    }
    { print }
    END {
      if (!replaced_openclaw) print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      if (!replaced_clawd) print "CLAWVIEW_CLAWD_DIR=" clawd_dir;
      if (!replaced_source) print "CLAWVIEW_DATA_SOURCE=openclaw";
      if (!replaced_origin) print "CLAWVIEW_ALLOWED_ORIGIN=http://localhost:" local_port;
      if (!replaced_local_port) print "CLAWVIEW_LOCAL_PORT=" local_port;
      if (!replaced_cli) print "CLAWVIEW_ENABLE_OPENCLAW_CLI=true";
    }
  ' "${ENV_FILE}" >"${tmp_env}"
  mv "${tmp_env}" "${ENV_FILE}"
}

install_dependencies() {
  if [ "${CLAWVIEW_FORCE_INSTALL:-0}" != "1" ] && [ -n "$(find "${ROOT_DIR}/node_modules/.pnpm" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
    print_step "检测到现有依赖，跳过重复安装"
    return 0
  fi

  print_step "安装依赖"
  cd "${ROOT_DIR}"
  corepack enable >/dev/null 2>&1 || true
  CI=1 COREPACK_HOME="${COREPACK_HOME}" corepack pnpm install
}

build_local_runtime() {
  print_step "构建本机可访问版本"
  cd "${ROOT_DIR}"
  COREPACK_HOME="${COREPACK_HOME}" corepack pnpm --filter @clawview/shared build >/dev/null
  COREPACK_HOME="${COREPACK_HOME}" corepack pnpm --filter @clawview/web build >/dev/null
  COREPACK_HOME="${COREPACK_HOME}" corepack pnpm --filter @clawview/server build >/dev/null

  # TypeScript preserves extensionless relative ESM imports, but Node.js
  # requires explicit ".js" extensions when executing the emitted files.
  ROOT_DIR_FOR_NODE="${ROOT_DIR}" node --input-type=module <<'EOF'
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.env.ROOT_DIR_FOR_NODE;
const distDir = join(rootDir, "apps/server/dist");

function visit(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      visit(fullPath);
      continue;
    }

    if (!fullPath.endsWith(".js")) {
      continue;
    }

    const source = readFileSync(fullPath, "utf8");
    const updated = source.replace(
      /(from\s+["'])(\.\.?\/[^"'\n]+?)(["'])/g,
      (match, prefix, specifier, suffix) =>
        specifier.endsWith(".js") ? match : `${prefix}${specifier}.js${suffix}`,
    );

    if (updated !== source) {
      writeFileSync(fullPath, updated);
    }
  }
}

visit(distDir);
EOF

  if [ -f "${ROOT_DIR}/apps/server/dist/index.js" ]; then
    SERVER_ENTRY="${ROOT_DIR}/apps/server/dist/index.js"
    return 0
  fi

  if [ -f "${ROOT_DIR}/apps/server/dist/apps/server/src/index.js" ]; then
    SERVER_ENTRY="${ROOT_DIR}/apps/server/dist/apps/server/src/index.js"
    return 0
  fi

  echo "没有找到服务端构建入口，请检查 apps/server/dist 产物。"
  return 1
}

kill_existing_processes() {
  if [ -f "${SERVER_PID_FILE}" ]; then
    local existing_pid
    existing_pid="$(cat "${SERVER_PID_FILE}" 2>/dev/null || true)"
    if [ -n "${existing_pid}" ] && kill -0 "${existing_pid}" >/dev/null 2>&1; then
      kill "${existing_pid}" >/dev/null 2>&1 || true
      sleep 1
      kill -9 "${existing_pid}" >/dev/null 2>&1 || true
    fi
    rm -f "${SERVER_PID_FILE}"
  fi

  if command -v pkill >/dev/null 2>&1; then
    pkill -f "apps/server/dist/index.js" >/dev/null 2>&1 || true
    pkill -f "apps/server/dist/apps/server/src/index.js" >/dev/null 2>&1 || true
    pkill -f "tsx watch src/index.ts" >/dev/null 2>&1 || true
    pkill -f "vite" >/dev/null 2>&1 || true
  fi
}

start_services() {
  print_step "启动本机服务"
  cd "${ROOT_DIR}"
  kill_existing_processes
  local app_port="${CLAWVIEW_LOCAL_PORT:-5173}"
  local clawd_dir
  clawd_dir="$(detect_clawd_dir "${OPENCLAW_HOME}")"

  if command -v python3 >/dev/null 2>&1; then
    ROOT_DIR_FOR_PYTHON="${ROOT_DIR}" \
    SERVER_ENTRY_FOR_PYTHON="${SERVER_ENTRY}" \
    SERVER_LOG_FOR_PYTHON="${SERVER_LOG}" \
    SERVER_PID_FILE_FOR_PYTHON="${SERVER_PID_FILE}" \
    OPENCLAW_HOME_FOR_PYTHON="${OPENCLAW_HOME}" \
    CLAWD_DIR_FOR_PYTHON="${clawd_dir}" \
    APP_PORT_FOR_PYTHON="${app_port}" \
    AGENT_NAME_FOR_PYTHON="${CLAWVIEW_AGENT_NAME:-我的 OpenClaw}" \
    python3 - <<'EOF'
import os
import subprocess

root_dir = os.environ["ROOT_DIR_FOR_PYTHON"]
server_entry = os.environ["SERVER_ENTRY_FOR_PYTHON"]
server_log = os.environ["SERVER_LOG_FOR_PYTHON"]
server_pid_file = os.environ["SERVER_PID_FILE_FOR_PYTHON"]

env = os.environ.copy()
env.update(
    {
        "CLAWVIEW_DATA_SOURCE": "openclaw",
        "CLAWVIEW_OPENCLAW_HOME": os.environ["OPENCLAW_HOME_FOR_PYTHON"],
        "CLAWVIEW_CLAWD_DIR": os.environ["CLAWD_DIR_FOR_PYTHON"],
        "CLAWVIEW_AGENT_NAME": os.environ["AGENT_NAME_FOR_PYTHON"],
        "CLAWVIEW_ALLOWED_ORIGIN": f"http://localhost:{os.environ['APP_PORT_FOR_PYTHON']}",
        "CLAWVIEW_BASE_URL": f"http://localhost:{os.environ['APP_PORT_FOR_PYTHON']}",
        "CLAWVIEW_ENABLE_OPENCLAW_CLI": "true",
        "CLAWVIEW_PORT": os.environ["APP_PORT_FOR_PYTHON"],
    }
)

with open(server_log, "ab", buffering=0) as log_file:
    process = subprocess.Popen(
        ["node", server_entry],
        cwd=root_dir,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

with open(server_pid_file, "w", encoding="utf-8") as pid_file:
    pid_file.write(f"{process.pid}\n")
EOF
    return 0
  fi

  nohup env \
    CLAWVIEW_DATA_SOURCE=openclaw \
    CLAWVIEW_OPENCLAW_HOME="${OPENCLAW_HOME}" \
    CLAWVIEW_CLAWD_DIR="${clawd_dir}" \
    CLAWVIEW_AGENT_NAME="${CLAWVIEW_AGENT_NAME:-我的 OpenClaw}" \
    CLAWVIEW_ALLOWED_ORIGIN="http://localhost:${app_port}" \
    CLAWVIEW_BASE_URL="http://localhost:${app_port}" \
    CLAWVIEW_ENABLE_OPENCLAW_CLI=true \
    CLAWVIEW_PORT="${app_port}" \
    node "${SERVER_ENTRY}" >"${SERVER_LOG}" 2>&1 </dev/null &

  printf '%s\n' "$!" > "${SERVER_PID_FILE}"
}

wait_for_local_services() {
  local app_port="${CLAWVIEW_LOCAL_PORT:-5173}"
  local attempts=0
  until curl -sf "http://localhost:${app_port}/api/v1/health" >/dev/null 2>&1; do
    if [ -f "${SERVER_PID_FILE}" ]; then
      local server_pid
      server_pid="$(cat "${SERVER_PID_FILE}" 2>/dev/null || true)"
      if [ -n "${server_pid}" ] && ! kill -0 "${server_pid}" >/dev/null 2>&1; then
        echo "服务进程提前退出，请检查 ${SERVER_LOG}"
        rm -f "${SERVER_PID_FILE}"
        return 1
      fi
    fi
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 40 ]; then
      echo "服务端启动超时，请检查 ${SERVER_LOG}"
      return 1
    fi
    sleep 2
  done

  attempts=0
  until curl -sf "http://localhost:${app_port}" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 40 ]; then
      echo "页面资源启动超时，请检查 ${SERVER_LOG}"
      return 1
    fi
    sleep 2
  done
}

main() {
  if [ ! -d "${OPENCLAW_HOME}" ]; then
    echo "没有找到 OpenClaw 数据目录：${OPENCLAW_HOME}"
    exit 1
  fi

  ensure_node
  write_env_file
  install_dependencies
  build_local_runtime
  start_services
  wait_for_local_services

  local app_url="http://localhost:${CLAWVIEW_LOCAL_PORT:-5173}"
  local browser_url="${app_url}/?v=$(date +%s)"
  echo "ClawView 本机模式已启动：${app_url}"
  echo "已接入 OpenClaw 目录：${OPENCLAW_HOME}"
  open_url "${browser_url}"
}

main "$@"
