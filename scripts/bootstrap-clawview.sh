#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"
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

show_dialog() {
  local message="$1"
  if command -v osascript >/dev/null 2>&1 && [ "$(current_platform)" = "darwin" ]; then
    osascript -e "display dialog \"${message}\" buttons {\"好\"} default button \"好\"" >/dev/null 2>&1 || true
  fi
}

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

pick_openclaw_dir() {
  local current_path="$1"
  if [ -d "${current_path}" ]; then
    printf '%s\n' "${current_path}"
    return
  fi

  if command -v osascript >/dev/null 2>&1 && [ "$(current_platform)" = "darwin" ]; then
    local picked_dir
    picked_dir="$(osascript -e 'tell application "System Events" to POSIX path of (choose folder with prompt "请选择你的 OpenClaw 数据目录")' 2>/dev/null || true)"
    if [ -n "${picked_dir}" ]; then
      printf '%s\n' "${picked_dir%/}"
      return
    fi
  fi

  printf '%s\n' "${current_path}"
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
  local openclaw_home="$1"
  local web_origin="$2"

  if [ ! -f "${ENV_FILE}" ]; then
    cp "${EXAMPLE_FILE}" "${ENV_FILE}"
  fi

  local tmp_env
  local clawd_dir
  tmp_env="$(mktemp)"
  clawd_dir="$(detect_clawd_dir "${openclaw_home}")"

  awk -v openclaw_home="${openclaw_home}" -v clawd_dir="${clawd_dir}" -v web_origin="${web_origin}" '
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
      print "CLAWVIEW_ALLOWED_ORIGIN=" web_origin;
      replaced_origin = 1;
      next;
    }
    { print }
    END {
      if (!replaced_openclaw) print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      if (!replaced_clawd) print "CLAWVIEW_CLAWD_DIR=" clawd_dir;
      if (!replaced_source) print "CLAWVIEW_DATA_SOURCE=openclaw";
      if (!replaced_origin) print "CLAWVIEW_ALLOWED_ORIGIN=" web_origin;
    }
  ' "${ENV_FILE}" >"${tmp_env}"

  mv "${tmp_env}" "${ENV_FILE}"
}

detect_docker_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    printf '%s\n' "docker compose"
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    printf '%s\n' "docker-compose"
    return 0
  fi

  return 1
}

wait_for_docker() {
  local attempts=0
  until docker info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 30 ]; then
      return 1
    fi
    sleep 2
  done

  return 0
}

try_start_docker_desktop() {
  if [ "$(current_platform)" != "darwin" ]; then
    return 1
  fi

  if command -v open >/dev/null 2>&1; then
    open -a Docker >/dev/null 2>&1 || return 1
    show_dialog "Docker Desktop 正在启动。第一次启动时，请在弹窗里完成系统授权，然后等待几秒。"
    return 0
  fi

  return 1
}

launch_docker_mode() {
  local compose_cmd="$1"
  local openclaw_home="$2"

  print_step "使用 Docker 模式启动 ClawView"
  write_env_file "${openclaw_home}" "http://localhost:3000"
  cd "${ROOT_DIR}"
  ${compose_cmd} up --build -d
  local app_url="http://localhost:3000"
  echo "ClawView 已启动：${app_url}"
  echo "已接入 OpenClaw 目录：${openclaw_home}"
  open_url "${app_url}"
}

launch_local_mode() {
  local openclaw_home="$1"
  print_step "切换到本机模式启动"
  "${SCRIPT_DIR}/launch-local-clawview.sh" "${openclaw_home}"
}

main() {
  local openclaw_home
  local compose_cmd

  openclaw_home="$(resolve_path "${1:-${CLAWVIEW_OPENCLAW_HOME:-${DEFAULT_OPENCLAW_HOME}}}")"
  openclaw_home="$(pick_openclaw_dir "${openclaw_home}")"

  if [ ! -d "${openclaw_home}" ]; then
    echo "没有找到 OpenClaw 数据目录。默认路径是 ${DEFAULT_OPENCLAW_HOME}。"
    echo "你也可以这样运行："
    echo "  ./scripts/bootstrap-clawview.sh /你的/openclaw/目录"
    exit 1
  fi

  if compose_cmd="$(detect_docker_compose)"; then
    if wait_for_docker || try_start_docker_desktop && wait_for_docker; then
      launch_docker_mode "${compose_cmd}" "${openclaw_home}"
      exit 0
    fi
  fi

  show_dialog "Docker 当前不可用，ClawView 将改用本机模式继续启动。"
  launch_local_mode "${openclaw_home}"
}

main "$@"
