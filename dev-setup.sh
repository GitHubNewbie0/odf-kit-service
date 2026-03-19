#!/usr/bin/env bash
set -euo pipefail

NC="docker compose -f docker-compose.dev.yml exec -T nextcloud"
OCC="$NC php occ"

echo "Waiting for Nextcloud..."
until $NC curl -sf http://localhost/status.php | grep -q '"installed":true'; do
  sleep 3
done

$OCC app:install app_api || $OCC app:enable app_api

$OCC app_api:daemon:register \
  manual_install "Manual Install" manual-install http localhost "" \
  || true

$OCC app_api:app:register odf-kit-service manual_install \
  --json-info '{
    "id":                  "odf-kit-service",
    "name":                "odf-kit Service",
    "daemon_config_name":  "manual_install",
    "version":             "0.1.0",
    "secret":              "dev-secret-change-me",
    "host":                "service",
    "port":                2600,
    "scopes":              ["FILES"],
    "system":              0
  }' \
  --force-scopes \
  || true

echo "Done. Nextcloud: http://localhost:8080 (admin/admin)  Service: http://localhost:2600"
