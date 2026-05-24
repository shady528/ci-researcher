#!/usr/bin/env bash
# start_researcher_daemon.sh
# Starts CI Researcher in one shot:
#   PostgreSQL → Redis → FastAPI backend → Next.js frontend
#
# Usage:
#   ./start_researcher_daemon.sh
#   BACKEND_PORT=9000 FRONTEND_PORT=4000 ./start_researcher_daemon.sh

# ── Config ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PID_FILE="$SCRIPT_DIR/.daemon.pids"
ENV_FILE="$SCRIPT_DIR/.env"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# PostgreSQL credentials from .env (defaults match the project .env)
PG_USER="${PG_USER:-ci_user}"
PG_PASS="${PG_PASS:-ci_pass_dev}"
PG_DB="${PG_DB:-ci_researcher}"

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

log()  { printf "${GREEN}[%s] ●${NC} %s\n"   "$(date +%H:%M:%S)" "$*"; }
info() { printf "${CYAN}         %s${NC}\n"   "$*"; }
warn() { printf "${YELLOW}[%s] ⚠${NC}  %s\n" "$(date +%H:%M:%S)" "$*"; }
die()  { printf "${RED}[%s] ✗${NC}  %s\n"    "$(date +%H:%M:%S)" "$*"; exit 1; }
sep()  { printf "\n${BOLD}── %s ──${NC}\n"   "$*"; }

# ── PID tracking ─────────────────────────────────────────────────
PIDS=()

cleanup() {
    printf "\n${YELLOW}Stopping all services...${NC}\n"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            info "Stopped PID $pid"
        fi
    done
    rm -f "$PID_FILE"
    printf "${GREEN}Shutdown complete.${NC}\n"
}

trap cleanup SIGINT SIGTERM

# ── Port check helper ─────────────────────────────────────────────
port_in_use() {
    ss -tlnp 2>/dev/null | grep -q ":$1 " || \
    lsof -ti:"$1" >/dev/null 2>&1
}

# ── Wait for HTTP endpoint ────────────────────────────────────────
wait_for_http() {
    local url="$1" label="$2" retries="${3:-30}"
    for i in $(seq 1 "$retries"); do
        if curl -sf "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    warn "$label did not respond at $url after ${retries}s — check logs"
    return 1
}

# ─────────────────────────────────────────────────────────────────
printf "${BOLD}"
printf "╔══════════════════════════════════════════════╗\n"
printf "║         CI Researcher — Daemon Start         ║\n"
printf "╚══════════════════════════════════════════════╝\n"
printf "${NC}\n"

# ── Load .env ─────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
    log "Loaded $ENV_FILE"
else
    warn ".env not found — API keys must already be in environment"
fi

mkdir -p "$LOG_DIR"
rm -f "$PID_FILE"
touch "$PID_FILE"

# ── Detect Python / uvicorn (venv-aware) ──────────────────────────
PYTHON="python3"
UVICORN="uvicorn"
for venv_dir in ".venv" "venv" "env"; do
    if [ -x "$SCRIPT_DIR/$venv_dir/bin/uvicorn" ]; then
        PYTHON="$SCRIPT_DIR/$venv_dir/bin/python3"
        UVICORN="$SCRIPT_DIR/$venv_dir/bin/uvicorn"
        log "Venv detected: $venv_dir"
        break
    fi
done

command -v "$UVICORN" >/dev/null 2>&1 || \
    die "uvicorn not found. Run: pip install uvicorn  (or activate your venv)"
command -v node >/dev/null 2>&1 || \
    die "node not found. Install Node.js >= 18"


# ═══════════════════════════════════════════════════════════════════
sep "1 / 4  PostgreSQL"
# ═══════════════════════════════════════════════════════════════════

if pg_isready -q 2>/dev/null; then
    log "PostgreSQL already running"
else
    log "Starting PostgreSQL..."
    # Works on both WSL2 (service) and native systemd
    if sudo service postgresql start 2>/dev/null || \
       sudo systemctl start postgresql 2>/dev/null; then
        sleep 2
    else
        die "Could not start PostgreSQL. Start it manually and re-run."
    fi
    pg_isready -q || die "PostgreSQL started but not responding"
    log "PostgreSQL started"
fi

# Provision user + database (idempotent — errors on existing objects are ignored)
info "Provisioning user '$PG_USER' and database '$PG_DB'..."
sudo -u postgres psql -c \
    "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS';" 2>/dev/null || true
sudo -u postgres psql -c \
    "ALTER USER $PG_USER WITH PASSWORD '$PG_PASS';" 2>/dev/null || true
sudo -u postgres psql -c \
    "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>/dev/null || true
sudo -u postgres psql -c \
    "GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;" 2>/dev/null || true

# Run schema setup (creates tables if not exist)
info "Applying schema..."
cd "$SCRIPT_DIR"
if "$PYTHON" src/db/setup.py >> "$LOG_DIR/db-setup.log" 2>&1; then
    log "Schema ready"
else
    warn "Schema setup had warnings — see logs/db-setup.log (safe to ignore if tables exist)"
fi


# ═══════════════════════════════════════════════════════════════════
sep "2 / 4  Redis"
# ═══════════════════════════════════════════════════════════════════

if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    log "Redis already running"
else
    log "Starting Redis..."
    # Try systemd first, fall back to direct server start
    if sudo service redis-server start 2>/dev/null || \
       sudo systemctl start redis 2>/dev/null; then
        sleep 1
    else
        redis-server \
            --daemonize yes \
            --logfile "$LOG_DIR/redis.log" \
            --loglevel notice \
        || die "Redis failed to start"
        sleep 1
    fi
    redis-cli ping 2>/dev/null | grep -q "PONG" || die "Redis not responding"
    log "Redis started"
fi


# ═══════════════════════════════════════════════════════════════════
sep "3 / 4  FastAPI Backend"
# ═══════════════════════════════════════════════════════════════════

if port_in_use "$BACKEND_PORT"; then
    warn "Port $BACKEND_PORT already in use — skipping backend start"
    info "If this is stale, run: kill \$(lsof -ti:$BACKEND_PORT)"
else
    log "Starting FastAPI on port $BACKEND_PORT..."
    cd "$SCRIPT_DIR"

    "$UVICORN" server:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --reload \
        --log-level info \
        >> "$LOG_DIR/backend.log" 2>&1 &

    BACKEND_PID=$!
    PIDS+=("$BACKEND_PID")
    echo "BACKEND_PID=$BACKEND_PID" >> "$PID_FILE"
    info "PID: $BACKEND_PID  |  log: logs/backend.log"

    wait_for_http "http://localhost:$BACKEND_PORT/" "Backend" 25 \
        && log "Backend ready"
fi


# ═══════════════════════════════════════════════════════════════════
sep "4 / 4  Next.js Frontend"
# ═══════════════════════════════════════════════════════════════════

if port_in_use "$FRONTEND_PORT"; then
    warn "Port $FRONTEND_PORT already in use — skipping frontend start"
    info "If this is stale, run: kill \$(lsof -ti:$FRONTEND_PORT)"
else
    log "Starting Next.js on port $FRONTEND_PORT..."
    cd "$SCRIPT_DIR/ci-researcher-ui"

    npm run dev -- -p "$FRONTEND_PORT" \
        >> "$LOG_DIR/frontend.log" 2>&1 &

    FRONTEND_PID=$!
    PIDS+=("$FRONTEND_PID")
    echo "FRONTEND_PID=$FRONTEND_PID" >> "$PID_FILE"
    info "PID: $FRONTEND_PID  |  log: logs/frontend.log"

    # Next.js takes longer to compile on first run
    wait_for_http "http://localhost:$FRONTEND_PORT/" "Frontend" 60 \
        && log "Frontend ready"
fi


# ═══════════════════════════════════════════════════════════════════
printf "\n${BOLD}"
printf "╔══════════════════════════════════════════════╗\n"
printf "║       CI Researcher — All Systems Go ✓       ║\n"
printf "╠══════════════════════════════════════════════╣\n"
printf "║${NC}  ${GREEN}●${BOLD} Frontend   →${NC} http://localhost:%-5s         ${BOLD}║\n" "$FRONTEND_PORT"
printf "║${NC}  ${GREEN}●${BOLD} Backend    →${NC} http://localhost:%-5s         ${BOLD}║\n" "$BACKEND_PORT"
printf "║${NC}  ${GREEN}●${BOLD} API Docs   →${NC} http://localhost:$BACKEND_PORT/docs      ${BOLD}║\n"
printf "║${NC}  ${GREEN}●${BOLD} PostgreSQL →${NC} localhost:5432                 ${BOLD}║\n"
printf "║${NC}  ${GREEN}●${BOLD} Redis      →${NC} localhost:6379                 ${BOLD}║\n"
printf "║                                              ║\n"
printf "║  PIDs saved to .daemon.pids                  ║\n"
printf "║  Logs in ./logs/                             ║\n"
printf "║  Press Ctrl+C to stop all services           ║\n"
printf "╚══════════════════════════════════════════════╝\n"
printf "${NC}\n"


# ═══════════════════════════════════════════════════════════════════
# Live log tail — shows backend + frontend output until Ctrl+C
# ═══════════════════════════════════════════════════════════════════
printf "${DIM}--- Tailing logs (Ctrl+C to stop all) ---${NC}\n\n"

tail -f \
    "$LOG_DIR/backend.log" \
    "$LOG_DIR/frontend.log" \
    2>/dev/null &

TAIL_PID=$!
PIDS+=("$TAIL_PID")

# Block until any tracked process dies or Ctrl+C is received
wait "${PIDS[@]}" 2>/dev/null
cleanup
