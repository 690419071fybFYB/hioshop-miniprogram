#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://api.fybshop.site}"
USER_NAME="${2:-qilelab.com}"
PASSWORD="${3:-qilelab.com}"

echo "[smoke] base url: $BASE_URL"

echo "[1/4] GET /api/index/appInfo"
curl -fsS "$BASE_URL/api/index/appInfo" >/tmp/hioshop_appinfo.json
grep -q '"errno":0' /tmp/hioshop_appinfo.json

echo "[2/4] GET /api/catalog/index"
curl -fsS "$BASE_URL/api/catalog/index" >/tmp/hioshop_catalog.json
grep -q '"errno":0' /tmp/hioshop_catalog.json

echo "[3/4] POST /admin/auth/login"
curl -fsS -X POST "$BASE_URL/admin/auth/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data "username=$USER_NAME&password=$PASSWORD" >/tmp/hioshop_login.json
grep -q '"errno":0' /tmp/hioshop_login.json

TOKEN=$(sed -n 's/.*"token":"\([^"]*\)".*/\1/p' /tmp/hioshop_login.json | head -n1)
if [[ -z "$TOKEN" ]]; then
  echo "[smoke] login token missing"
  exit 1
fi

echo "[4/4] GET /api/cart/goodsCount (auth)"
curl -fsS "$BASE_URL/api/cart/goodsCount" \
  -H "X-Hioshop-Token: $TOKEN" >/tmp/hioshop_cart_count.json
grep -q '"errno":0' /tmp/hioshop_cart_count.json

echo "[smoke] all checks passed"
