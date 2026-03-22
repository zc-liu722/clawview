#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-tailnet}"
PORT_INPUT="${2:-}"

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

detect_port() {
  if [ -n "${PORT_INPUT}" ]; then
    printf '%s\n' "${PORT_INPUT}"
    return
  fi

  if command -v curl >/dev/null 2>&1 && curl -sf http://127.0.0.1:3000 >/dev/null 2>&1; then
    printf '3000\n'
    return
  fi

  if command -v curl >/dev/null 2>&1 && curl -sf http://127.0.0.1:5173 >/dev/null 2>&1; then
    printf '5173\n'
    return
  fi

  printf '3000\n'
}

ensure_tailscale() {
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "需要先安装 Tailscale CLI 才能远程分享 ClawView。"
    echo "文档: https://tailscale.com/download"
    exit 1
  fi
}

ensure_tailscale_up() {
  if tailscale status >/dev/null 2>&1; then
    return 0
  fi

  echo "Tailscale 当前未连接，请先执行 tailscale up。"
  exit 1
}

main() {
  local mode
  local port

  mode="$(lower "${MODE}")"
  port="$(detect_port)"

  ensure_tailscale
  ensure_tailscale_up

  case "${mode}" in
    tailnet|private)
      echo "在你的 tailnet 内分享 ClawView: https://<your-device>.<tailnet>.ts.net"
      exec tailscale serve "${port}"
      ;;
    public|funnel)
      echo "把 ClawView 暴露到公网。首次使用可能需要浏览器里批准 Funnel。"
      exec tailscale funnel "${port}"
      ;;
    *)
      echo "用法: ./scripts/share-clawview.sh [tailnet|public] [port]"
      exit 1
      ;;
  esac
}

main "$@"
