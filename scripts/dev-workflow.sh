#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/storage/framework"
PID_FILE="$PID_DIR/vite-watch.pid"
LOG_FILE="$ROOT_DIR/storage/logs/vite-watch.log"

mkdir -p "$PID_DIR" "$ROOT_DIR/storage/logs"

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

start_watch() {
  if is_running; then
    echo "Vite watch already running (pid $(cat "$PID_FILE"))."
    exit 0
  fi

  echo "Starting Vite watch mode (auto rebuild on file changes)..."
  cd "$ROOT_DIR"
  nohup npm run dev:watch >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  sleep 1
  if is_running; then
    echo "Started successfully (pid $(cat "$PID_FILE"))."
    echo "Logs: $LOG_FILE"
  else
    echo "Failed to start Vite watch. Check logs: $LOG_FILE"
    exit 1
  fi
}

stop_watch() {
  if ! is_running; then
    echo "Vite watch is not running."
    rm -f "$PID_FILE"
    exit 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  echo "Stopping Vite watch (pid $pid)..."
  kill "$pid" 2>/dev/null || true
  sleep 1

  if kill -0 "$pid" 2>/dev/null; then
    echo "Force stopping Vite watch (pid $pid)..."
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
  echo "Stopped."
}

status_watch() {
  if is_running; then
    echo "Vite watch is running (pid $(cat "$PID_FILE"))."
    echo "Logs: $LOG_FILE"
  else
    echo "Vite watch is NOT running."
  fi
}

logs_watch() {
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "Log file not found: $LOG_FILE"
    exit 0
  fi
  tail -n 120 -f "$LOG_FILE"
}

case "${1:-}" in
  start)
    start_watch
    ;;
  stop)
    stop_watch
    ;;
  status)
    status_watch
    ;;
  logs)
    logs_watch
    ;;
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    exit 1
    ;;
esac
