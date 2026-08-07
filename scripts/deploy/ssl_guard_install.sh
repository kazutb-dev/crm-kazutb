#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root: sudo $0"
    exit 1
fi

SRC_SCRIPT="/home/admaza/projects/laravel-react/scripts/deploy/ssl_guard_check.sh"
DST_SCRIPT="/usr/local/sbin/ssl_guard_check.sh"
SERVICE_FILE="/etc/systemd/system/ssl-guard.service"
TIMER_FILE="/etc/systemd/system/ssl-guard.timer"

if [[ ! -f "$SRC_SCRIPT" ]]; then
    echo "Missing source script: $SRC_SCRIPT"
    exit 1
fi

install -m 0755 "$SRC_SCRIPT" "$DST_SCRIPT"

cat > "$SERVICE_FILE" <<'EOF'
[Unit]
Description=SSL Certificate Runtime Guard (KazUTB CRM)
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/ssl_guard_check.sh --reload-on-mismatch
User=root
Group=root
EOF

cat > "$TIMER_FILE" <<'EOF'
[Unit]
Description=Run SSL Certificate Runtime Guard every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
AccuracySec=30s
Unit=ssl-guard.service
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now ssl-guard.timer

echo "ssl-guard.timer status:"
systemctl --no-pager --full status ssl-guard.timer | sed -n '1,60p'

echo "Running one immediate check:"
"$DST_SCRIPT" --reload-on-mismatch

echo "Done. SSL runtime guard installed."
