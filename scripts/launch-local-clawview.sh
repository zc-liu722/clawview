#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"
COREPACK_HOME="${ROOT_DIR}/.corepack"
SERVER_LOG="${ROOT_DIR}/.clawview-server.log"
WEB_LOG="${ROOT_DIR}/.clawview-web.log"
DEFAULT_OPENCLAW_HOME="${HOME}/.openclaw"

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

OPENCLAW_HOME="$(resolve_path "${1:-${CLAWVIEW_OPENCLAW_HOME:-${DEFAULT_OPENCLAW_HOME}}}")"

ask_yes_no() {
  local message="$1"
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
  tmp_env="$(mktemp)"
  clawd_dir="$(detect_clawd_dir "${OPENCLAW_HOME}")"

  awk -v openclaw_home="${OPENCLAW_HOME}" -v clawd_dir="${clawd_dir}" '
    BEGIN {
      replaced_openclaw = 0;
      replaced_clawd = 0;
      replaced_source = 0;
      replaced_origin = 0;
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
      print "CLAWVIEW_ALLOWED_ORIGIN=http://localhost:5173";
      replaced_origin = 1;
      next;
    }
    { print }
    END {
      if (!replaced_openclaw) print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      if (!replaced_clawd) print "CLAWVIEW_CLAWD_DIR=" clawd_dir;
      if (!replaced_source) print "CLAWVIEW_DATA_SOURCE=openclaw";
      if (!replaced_origin) print "CLAWVIEW_ALLOWED_ORIGIN=http://localhost:5173";
    }
  ' "${ENV_FILE}" >"${tmp_env}"
  mv "${tmp_env}" "${ENV_FILE}"
}

install_dependencies() {
  print_step "安装依赖"
  cd "${ROOT_DIR}"
  corepack enable >/dev/null 2>&1 || true
  COREPACK_HOME="${COREPACK_HOME}" corepack pnpm install
}

kill_existing_processes() {
  if command -v pkill >/dev/null 2>&1; then
    pkill -f "tsx watch src/index.ts" >/dev/null 2>&1 || true
    pkill -f "vite" >/dev/null 2>&1 || true
  fi
}

start_services() {
  print_step "启动本机服务"
  cd "${ROOT_DIR}"
  kill_existing_processes

  CLAWVIEW_DATA_SOURCE=openclaw \
  CLAWVIEW_OPENCLAW_HOME="${OPENCLAW_HOME}" \
  CLAWVIEW_CLAWD_DIR="$(detect_clawd_dir "${OPENCLAW_HOME}")" \
  CLAWVIEW_AGENT_NAME="${CLAWVIEW_AGENT_NAME:-我的 OpenClaw}" \
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
  open_url "${app_url}"
}

main "$@"
