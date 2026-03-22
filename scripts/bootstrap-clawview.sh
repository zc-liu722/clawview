#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"
DEFAULT_OPENCLAW_HOME="${HOME}/.openclaw"

print_step() {
  echo ""
  echo "==> $1"
}

show_dialog() {
  local message="$1"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display dialog \"${message}\" buttons {\"好\"} default button \"好\"" >/dev/null 2>&1 || true
  fi
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

pick_openclaw_dir() {
  local current_path="$1"
  if [ -d "${current_path}" ]; then
    echo "${current_path}"
    return
  fi

  if command -v osascript >/dev/null 2>&1; then
    local picked_dir
    picked_dir="$(osascript -e 'tell application "System Events" to POSIX path of (choose folder with prompt "请选择你的 OpenClaw 数据目录")' 2>/dev/null || true)"
    if [ -n "${picked_dir}" ]; then
      echo "${picked_dir%/}"
      return
    fi
  fi

  echo "${current_path}"
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return 0
  fi

  if ! ask_yes_no "你的电脑还没有安装 Homebrew。ClawView 可以先自动安装 Homebrew，再继续安装 Docker 或 Node。现在开始吗？"; then
    return 1
  fi

  print_step "安装 Homebrew"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  command -v brew >/dev/null 2>&1
}

wait_for_docker() {
  local attempts=0
  until docker info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 60 ]; then
      return 1
    fi
    sleep 2
  done

  return 0
}

ensure_docker_desktop() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi

  if ! ensure_homebrew; then
    return 1
  fi

  if ! ask_yes_no "ClawView 建议使用 Docker Desktop 一键启动。现在自动安装 Docker Desktop 吗？安装过程中 macOS 可能会要求你输入密码。"; then
    return 1
  fi

  print_step "安装 Docker Desktop"
  brew install --cask docker
  open -a Docker
  show_dialog "Docker Desktop 正在启动。第一次启动时，请在弹窗里完成系统授权，然后等待几秒。"

  wait_for_docker
}

write_env_file() {
  local openclaw_home="$1"
  local web_origin="$2"

  if [ ! -f "${ENV_FILE}" ]; then
    cp "${EXAMPLE_FILE}" "${ENV_FILE}"
  fi

  local tmp_env
  tmp_env="$(mktemp)"

  awk -v openclaw_home="${openclaw_home}" -v web_origin="${web_origin}" '
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
      print "CLAWVIEW_ALLOWED_ORIGIN=" web_origin;
      replaced_origin = 1;
      next;
    }
    { print }
    END {
      if (!replaced_openclaw) print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      if (!replaced_source) print "CLAWVIEW_DATA_SOURCE=openclaw";
      if (!replaced_origin) print "CLAWVIEW_ALLOWED_ORIGIN=" web_origin;
    }
  ' "${ENV_FILE}" >"${tmp_env}"

  mv "${tmp_env}" "${ENV_FILE}"
}

launch_docker_mode() {
  local openclaw_home="$1"
  print_step "使用 Docker 模式启动 ClawView"
  write_env_file "${openclaw_home}" "http://localhost:3000"
  cd "${ROOT_DIR}"
  docker compose up --build -d
  local app_url="http://localhost:3000"
  echo "ClawView 已启动：${app_url}"
  echo "已接入 OpenClaw 目录：${openclaw_home}"
  command -v open >/dev/null 2>&1 && open "${app_url}"
}

launch_local_mode() {
  local openclaw_home="$1"
  print_step "切换到本机模式启动"
  "${SCRIPT_DIR}/launch-local-clawview.sh" "${openclaw_home}"
}

main() {
  local openclaw_home
  openclaw_home="${1:-${CLAWVIEW_OPENCLAW_HOME:-${DEFAULT_OPENCLAW_HOME}}}"
  openclaw_home="$(pick_openclaw_dir "${openclaw_home}")"

  if [ ! -d "${openclaw_home}" ]; then
    echo "没有找到 OpenClaw 数据目录。默认路径是 ${DEFAULT_OPENCLAW_HOME}。"
    echo "你也可以这样运行："
    echo "  ./scripts/bootstrap-clawview.sh /你的/openclaw/目录"
    exit 1
  fi

  if ensure_docker_desktop; then
    if wait_for_docker; then
      launch_docker_mode "${openclaw_home}"
      exit 0
    fi
  fi

  show_dialog "Docker 没有准备好，ClawView 将改用本机模式继续启动。"
  launch_local_mode "${openclaw_home}"
}

main "$@"
