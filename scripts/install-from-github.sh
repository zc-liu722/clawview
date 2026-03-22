#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CLAWVIEW_REPO_URL:-https://github.com/zc-liu722/clawview.git}"
BRANCH="${CLAWVIEW_BRANCH:-main}"
INSTALL_DIR="${CLAWVIEW_INSTALL_DIR:-${HOME}/clawview}"
OPENCLAW_HOME_INPUT="${CLAWVIEW_OPENCLAW_HOME:-}"
NON_INTERACTIVE="${CLAWVIEW_NON_INTERACTIVE:-0}"

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
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
      printf '%s\n' "${path_value}"
      ;;
  esac
}

print_step() {
  printf '\n==> %s\n' "$1"
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --non-interactive)
        NON_INTERACTIVE=1
        shift
        ;;
      -h|--help)
        echo "Usage: ./scripts/install-from-github.sh [--non-interactive] [OPENCLAW_HOME]"
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

ask_yes_no() {
  local message="$1"
  printf '%s [Y/n] ' "${message}"
  read -r reply
  reply="$(lower "${reply:-}")"
  [ -z "${reply}" ] || [ "${reply}" = "y" ] || [ "${reply}" = "yes" ]
}

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi

  echo "需要先安装 git 才能从 GitHub 拉取 ClawView。"
  echo "macOS 可先安装 Xcode Command Line Tools；Linux 可用系统包管理器安装 git。"
  exit 1
}

clone_or_update_repo() {
  if [ -d "${INSTALL_DIR}/.git" ]; then
    print_step "更新已有的 ClawView 仓库"
    git -C "${INSTALL_DIR}" fetch --depth=1 origin "${BRANCH}"
    git -C "${INSTALL_DIR}" checkout "${BRANCH}"
    git -C "${INSTALL_DIR}" pull --ff-only origin "${BRANCH}"
    return 0
  fi

  if [ -e "${INSTALL_DIR}" ] && [ ! -d "${INSTALL_DIR}/.git" ]; then
    echo "安装目录已存在但不是 git 仓库：${INSTALL_DIR}"
    exit 1
  fi

  print_step "从 GitHub 下载 ClawView"
  git clone --depth=1 --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
}

prepare_env_defaults() {
  local openclaw_home
  local env_file
  local example_file

  openclaw_home="$(resolve_path "${OPENCLAW_HOME_INPUT}")"
  env_file="${INSTALL_DIR}/.env"
  example_file="${INSTALL_DIR}/.env.example"

  if [ ! -f "${env_file}" ]; then
    cp "${example_file}" "${env_file}"
  fi

  if [ -n "${openclaw_home}" ] && [ -d "${openclaw_home}" ]; then
    local tmp_env
    tmp_env="$(mktemp)"
    awk -v openclaw_home="${openclaw_home}" '
      BEGIN { replaced = 0 }
      /^CLAWVIEW_OPENCLAW_HOME=/ {
        print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
        replaced = 1;
        next;
      }
      { print }
      END {
        if (!replaced) print "CLAWVIEW_OPENCLAW_HOME=" openclaw_home;
      }
    ' "${env_file}" > "${tmp_env}"
    mv "${tmp_env}" "${env_file}"
  fi
}

main() {
  parse_args "$@"
  ensure_git

  clone_or_update_repo
  prepare_env_defaults

  print_step "启动 ClawView 引导脚本"
  local bootstrap_args=()
  if [ "${NON_INTERACTIVE}" = "1" ]; then
    bootstrap_args+=("--non-interactive")
  fi
  if [ -n "${OPENCLAW_HOME_INPUT}" ]; then
    "${INSTALL_DIR}/scripts/bootstrap-clawview.sh" "${bootstrap_args[@]}" "$(resolve_path "${OPENCLAW_HOME_INPUT}")"
    exit 0
  fi

  "${INSTALL_DIR}/scripts/bootstrap-clawview.sh" "${bootstrap_args[@]}"
}

main "$@"
