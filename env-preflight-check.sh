#!/usr/bin/env bash
set -e

echo "=== Laravel Environment Pre-Flight Check ==="
echo "Current directory: $(pwd)"
echo "APP_ENV: $(grep '^APP_ENV=' .env | cut -d '=' -f2-)"
echo "APP_URL: $(grep '^APP_URL=' .env | cut -d '=' -f2-)"
echo "DB_DATABASE: $(grep '^DB_DATABASE=' .env | cut -d '=' -f2-)"
echo "============================================"
