#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
MODE="auto"
SKIP_TYPECHECK=0

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/smoke-check.sh [--mode auto|docker|local] [--env /path/to/.env] [--skip-typecheck]

Checks:
  - required files and paths
  - OpenClaw/clawd directory visibility
  - Docker mode readiness
  - local mode readiness
  - optional TypeScript typecheck
  - health endpoints for already-running services
EOF
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[WARN] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$1"
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

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --env)
      ENV_FILE="$(resolve_path "${2:-}")"
      shift 2
      ;;
    --skip-typecheck)
      SKIP_TYPECHECK=1
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      print_usage
      exit 1
      ;;
  esac
done

MODE="$(lower "${MODE}")"
if [ "${MODE}" != "auto" ] && [ "${MODE}" != "docker" ] && [ "${MODE}" != "local" ]; then
  echo "Unsupported mode: ${MODE}"
  exit 1
fi

load_env_file() {
  local env_path="$1"
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    if [ -z "${line}" ] || [ "${line#\#}" != "${line}" ]; then
      continue
    fi

    if [[ "${line}" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"

    case "${value}" in
      \"*\")
        value="${value#\"}"
        value="${value%\"}"
        ;;
      \'*\')
        value="${value#\'}"
        value="${value%\'}"
        ;;
    esac

    export "${key}=${value}"
  done < "${env_path}"
}

if [ -f "${ENV_FILE}" ]; then
  load_env_file "${ENV_FILE}"
  pass "Loaded environment from ${ENV_FILE}"
else
  warn "No .env file found at ${ENV_FILE}; falling back to current shell env and defaults"
fi

CLAWVIEW_DATA_SOURCE="${CLAWVIEW_DATA_SOURCE:-openclaw}"
CLAWVIEW_OPENCLAW_HOME="$(resolve_path "${CLAWVIEW_OPENCLAW_HOME:-${HOME}/.openclaw}")"
CLAWVIEW_CLAWD_DIR="$(resolve_path "${CLAWVIEW_CLAWD_DIR:-${HOME}/clawd}")"
CLAWVIEW_LOCAL_PORT="${CLAWVIEW_LOCAL_PORT:-5173}"
CLAWVIEW_PORT="${CLAWVIEW_PORT:-8787}"
CLAWVIEW_ALLOWED_ORIGIN="${CLAWVIEW_ALLOWED_ORIGIN:-}"
if [ -n "${CLAWVIEW_WEB_PORT:-}" ]; then
  CLAWVIEW_WEB_PORT="${CLAWVIEW_WEB_PORT}"
elif [ "${MODE}" = "local" ] || [ "${CLAWVIEW_ALLOWED_ORIGIN}" = "http://localhost:5173" ]; then
  CLAWVIEW_WEB_PORT="${CLAWVIEW_LOCAL_PORT}"
else
  CLAWVIEW_WEB_PORT="3000"
fi

check_file_presence() {
  for file_path in \
    "${ROOT_DIR}/docker-compose.yml" \
    "${ROOT_DIR}/apps/server/src/index.ts" \
    "${ROOT_DIR}/apps/web/src/main.tsx"; do
    if [ -f "${file_path}" ]; then
      pass "Found $(basename "${file_path}")"
    else
      fail "Missing required file ${file_path}"
    fi
  done
}

check_openclaw_paths() {
  if [ "${CLAWVIEW_DATA_SOURCE}" != "openclaw" ]; then
    warn "CLAWVIEW_DATA_SOURCE=${CLAWVIEW_DATA_SOURCE}; OpenClaw-specific checks skipped"
    return
  fi

  if [ -d "${CLAWVIEW_OPENCLAW_HOME}" ]; then
    pass "OpenClaw directory exists: ${CLAWVIEW_OPENCLAW_HOME}"
  else
    fail "OpenClaw directory not found: ${CLAWVIEW_OPENCLAW_HOME}"
  fi

  if [ -d "${CLAWVIEW_CLAWD_DIR}" ]; then
    pass "clawd directory exists: ${CLAWVIEW_CLAWD_DIR}"
  else
    warn "clawd directory not found: ${CLAWVIEW_CLAWD_DIR}; memory write-back may not work as expected"
  fi

  if find "${CLAWVIEW_OPENCLAW_HOME}" -maxdepth 5 \( -path '*/sessions' -o -name 'transcript.jsonl' -o -name '*.jsonl' \) | head -n 1 | grep -q .; then
    pass "Detected transcript/session artifacts under OpenClaw directory"
  else
    warn "No transcript/session artifacts found under ${CLAWVIEW_OPENCLAW_HOME}"
  fi

  if find "${CLAWVIEW_CLAWD_DIR}" "${CLAWVIEW_OPENCLAW_HOME}" -maxdepth 4 -name '*.md' 2>/dev/null | head -n 1 | grep -q .; then
    pass "Detected memory markdown files"
  else
    warn "No memory markdown files detected under clawd/OpenClaw paths"
  fi
}

check_docker_mode() {
  if [ "${MODE}" = "local" ]; then
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    pass "docker command is available"
  else
    if [ "${MODE}" = "docker" ]; then
      fail "docker command is required for docker mode"
    else
      warn "docker command is not available"
    fi
    return
  fi

  if docker info >/dev/null 2>&1; then
    pass "Docker daemon is reachable"
  else
    if [ "${MODE}" = "docker" ]; then
      fail "Docker daemon is not reachable"
    else
      warn "Docker daemon is not reachable"
    fi
  fi

  if docker compose version >/dev/null 2>&1; then
    pass "docker compose is available"
  elif command -v docker-compose >/dev/null 2>&1; then
    pass "docker-compose is available"
  else
    if [ "${MODE}" = "docker" ]; then
      fail "docker compose or docker-compose is required for docker mode"
    else
      warn "docker compose is not available"
    fi
  fi
}

check_local_mode() {
  if [ "${MODE}" = "docker" ]; then
    return
  fi

  if command -v node >/dev/null 2>&1; then
    pass "node command is available"
  else
    if [ "${MODE}" = "local" ]; then
      fail "node is required for local mode"
    else
      warn "node is not available"
    fi
  fi

  if command -v corepack >/dev/null 2>&1; then
    pass "corepack command is available"
  else
    if [ "${MODE}" = "local" ]; then
      fail "corepack is required for local mode"
    else
      warn "corepack is not available"
    fi
  fi

  if command -v curl >/dev/null 2>&1; then
    pass "curl command is available"
  else
    warn "curl is not available; runtime health checks will be skipped"
  fi
}

check_running_services() {
  if ! command -v curl >/dev/null 2>&1; then
    return
  fi

  local server_port="${CLAWVIEW_PORT}"
  if curl -sf "http://localhost:${server_port}/api/v1/health" >/dev/null 2>&1; then
    pass "Server health endpoint responded on localhost:${server_port}"
  elif curl -sf "http://localhost:${CLAWVIEW_WEB_PORT}/api/v1/health" >/dev/null 2>&1; then
    pass "Server health endpoint responded on localhost:${CLAWVIEW_WEB_PORT}"
  else
    warn "Server health endpoint is not reachable on localhost:${server_port} or localhost:${CLAWVIEW_WEB_PORT}"
  fi

  if curl -sf "http://localhost:${CLAWVIEW_WEB_PORT}" >/dev/null 2>&1; then
    pass "Web app responded on localhost:${CLAWVIEW_WEB_PORT}"
  else
    warn "Web app is not reachable on localhost:${CLAWVIEW_WEB_PORT}"
  fi
}

run_typecheck() {
  if [ "${SKIP_TYPECHECK}" -eq 1 ]; then
    warn "Typecheck skipped by flag"
    return
  fi

  if ! command -v corepack >/dev/null 2>&1; then
    warn "Skipping typecheck because corepack is unavailable"
    return
  fi

  if COREPACK_HOME="${ROOT_DIR}/.corepack" corepack pnpm -r typecheck >/dev/null; then
    pass "TypeScript typecheck passed"
  else
    fail "TypeScript typecheck failed"
  fi
}

print_recommendation() {
  printf '\nSummary: %s passed, %s warnings, %s failed\n' "${PASS_COUNT}" "${WARN_COUNT}" "${FAIL_COUNT}"

  if [ "${FAIL_COUNT}" -gt 0 ]; then
    printf 'Result: blocking issues found. Fix FAIL items before deployment.\n'
    exit 1
  fi

  if [ "${WARN_COUNT}" -gt 0 ]; then
    printf 'Result: deployment is possible, but review WARN items before going live.\n'
  else
    printf 'Result: smoke check passed.\n'
  fi
}

check_file_presence
check_openclaw_paths
check_docker_mode
check_local_mode
run_typecheck
check_running_services
print_recommendation
