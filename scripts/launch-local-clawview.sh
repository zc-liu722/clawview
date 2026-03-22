#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"
OPENCLAW_HOME="${1:-${CLAWVIEW_OPENCLAW_HOME:-$HOME/.openclaw}}"
COREPACK_HOME="${ROOT_DIR}/.corepack"
SERVER_LOG="${ROOT_DIR}/.clawview-server.log"
WEB_LOG="${ROOT_DIR}/.clawview-web.log"

print_step() {
  echo ""
  echo "==> $1"
}

ask_yes_no() {
  local message="$1"
  if command -v osascript >/dev/null 2>&1; then
    local result
    result="$(osascript -e "button returned of (display dialog \"${message}\" buttons {\"取消\", \"继续\"} default button \"继续\")" 2>/dev/null || true)"
    [ "${result}" = "继续" ]
    return
  fi

  printf "%s [Y/n] " "${message}"
  read -r reply
  [ -z "${reply}" ] || [[ "${reply:l}" = "y" ]]
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return 0
  fi

  if ! ask_yes_no "本机模式需要 Node.js。你的电脑还没有 Homebrew，是否先自动安装 Homebrew？"; then
    return 1
  fi

  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  ensure_homebrew
  print_step "安装 Node.js"
  brew install node
}

write_env_file() {
  if [ ! -f "${ENV_FILE}" ]; then
    cp "${EXAMPLE_FILE}" "${ENV_FILE}"
  fi

  local tmp_env
  tmp_env="$(mktemp)"
  awk -v openclaw_home="${OPENCLAW_HOME}" '
    BEGIN {
      replaced_openclaw = 0;
      replaced_source = 0;
      replaced_origin = 0;
    }
    /^CLAWVIEW_OPENCLAW_HOME=/ {
      print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      replaced_openclaw = 1;
      next;
    }
    /^CLAWVIEW_DATA_SOURCE=/ {
      print "CLAWVIEW_DATA_SOURCE=openclaw";
      replaced_source = 1;
      next;
    }
    /^CLAWVIEW_ALLOWED_ORIGIN=/ {
      print "CLAWVIEW_ALLOWED_ORIGIN=http://localhost:5173";
      replaced_origin = 1;
      next;
    }
    { print }
    END {
      if (!replaced_openclaw) print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      if (!replaced_source) print "CLAWVIEW_DATA_SOURCE=openclaw";
      if (!replaced_origin) print "CLAWVIEW_ALLOWED_ORIGIN=http://localhost:5173";
    }
  ' "${ENV_FILE}" >"${tmp_env}"
  mv "${tmp_env}" "${ENV_FILE}"
}

install_dependencies() {
  print_step "安装依赖"
  cd "${ROOT_DIR}"
  COREPACK_HOME="${COREPACK_HOME}" corepack pnpm install
}

kill_existing_processes() {
  pkill -f "tsx watch src/index.ts" >/dev/null 2>&1 || true
  pkill -f "vite" >/dev/null 2>&1 || true
}

start_services() {
  print_step "启动本机服务"
  cd "${ROOT_DIR}"
  kill_existing_processes

  CLAWVIEW_DATA_SOURCE=openclaw \
  CLAWVIEW_OPENCLAW_HOME="${OPENCLAW_HOME}" \
  CLAWVIEW_AGENT_NAME="我的 OpenClaw" \
  COREPACK_HOME="${COREPACK_HOME}" \
  corepack pnpm --filter @clawview/server dev >"${SERVER_LOG}" 2>&1 &

  COREPACK_HOME="${COREPACK_HOME}" \
  corepack pnpm --filter @clawview/web dev >"${WEB_LOG}" 2>&1 &
}

wait_for_local_services() {
  local attempts=0
  until curl -sf http://localhost:8787/api/v1/health >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 40 ]; then
      echo "服务端启动超时，请检查 ${SERVER_LOG}"
      return 1
    fi
    sleep 2
  done

  attempts=0
  until curl -sf http://localhost:5173 >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 40 ]; then
      echo "前端启动超时，请检查 ${WEB_LOG}"
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
  start_services
  wait_for_local_services

  local app_url="http://localhost:5173"
  echo "ClawView 本机模式已启动：${app_url}"
  echo "已接入 OpenClaw 目录：${OPENCLAW_HOME}"
  command -v open >/dev/null 2>&1 && open "${app_url}"
}

main "$@"
