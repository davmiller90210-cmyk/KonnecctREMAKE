#!/bin/bash
# =============================================================================
# Konnecct Matrix Bootstrap — Zero Friction Version
# =============================================================================
set -e

COMPOSE_FILE="docker-compose.prod.yml"
SERVICE_NAME="synapse"
ADMIN_USERNAME="konnecct_admin"

echo "🏁 Starting Matrix Bootstrap..."

# 1. Verify Synapse is running (by service name, not container name)
echo "[1/5] Checking if the Matrix backend is online..."
if ! docker compose -f $COMPOSE_FILE ps $SERVICE_NAME --status running --format json | grep -q "running"; then
  echo "  ✗ Matrix service is not running. Let's start it..."
  docker compose -f $COMPOSE_FILE up -d $SERVICE_NAME synapse-db
  echo "  Waiting 10 seconds for it to settle..."
  sleep 10
fi
echo "  ✓ Matrix backend is running."

# 2. Generate secure secrets
echo "[2/5] Generating fresh security keys..."
REGISTRATION_SECRET=$(openssl rand -hex 32)
MACAROON_SECRET=$(openssl rand -hex 32)
FORM_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -hex 16)
SYNAPSE_DB_PASSWORD=$(openssl rand -hex 20)
echo "  ✓ Keys generated."

# 3. Update homeserver.yaml
echo "[3/5] Injecting keys into homeserver.yaml..."
sed -i "s|\${MATRIX_REGISTRATION_SHARED_SECRET}|${REGISTRATION_SECRET}|g" synapse/homeserver.yaml
sed -i "s|\${MATRIX_MACAROON_SECRET}|${MACAROON_SECRET}|g" synapse/homeserver.yaml
sed -i "s|\${MATRIX_FORM_SECRET}|${FORM_SECRET}|g" synapse/homeserver.yaml
sed -i "s|\${SYNAPSE_DB_PASSWORD:-synapse-pass}|${SYNAPSE_DB_PASSWORD}|g" synapse/homeserver.yaml

echo "  → Restarting to apply new configuration..."
docker compose -f $COMPOSE_FILE restart $SERVICE_NAME

# Wait for health
echo "  → Waiting for database initialization (up to 60s)..."
until docker compose -f $COMPOSE_FILE exec -T $SERVICE_NAME curl -s http://localhost:8008/_matrix/client/versions > /dev/null; do
  echo "    ... still waiting"
  sleep 5
done
echo "  ✓ Backend is READY."

# 4. Provision Admin Account
echo "[4/5] Creating the Matrix Admin account (@${ADMIN_USERNAME})..."
NONCE_JSON=$(docker compose -f $COMPOSE_FILE exec -T $SERVICE_NAME curl -s http://localhost:8008/_synapse/admin/v1/register)
NONCE=$(echo $NONCE_JSON | sed -n 's/.*"nonce":"\([^"]*\)".*/\1/p')

if [ -z "$NONCE" ]; then
  echo "  ✗ Error: Could not get registration nonce. Logs:"
  docker compose -f $COMPOSE_FILE logs --tail 20 $SERVICE_NAME
  exit 1
fi

MAC=$(echo -n "${NONCE}\0${ADMIN_USERNAME}\0${ADMIN_PASSWORD}\0admin" | \
  openssl dgst -sha1 -hmac "${REGISTRATION_SECRET}" | awk '{print $2}')

REGISTER_RESULT=$(docker compose -f $COMPOSE_FILE exec -T $SERVICE_NAME \
  curl -s -X POST http://localhost:8008/_synapse/admin/v1/register \
    -H "Content-Type: application/json" \
    -d "{\"nonce\":\"${NONCE}\",\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"mac\":\"${MAC}\",\"admin\":true}")

ADMIN_TOKEN=$(echo $REGISTER_RESULT | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

if [ -z "$ADMIN_TOKEN" ]; then
  echo "  ✗ Admin account creation failed. It might already exist."
else
  echo "  ✓ Admin account created successfully."
fi

# 5. Output .env block
echo ""
echo "[5/5] Done! COPY THIS INTO YOUR .env FILE ON THE VM:"
echo "------------------------------------------------------------"
echo "MATRIX_REGISTRATION_SHARED_SECRET=${REGISTRATION_SECRET}"
echo "MATRIX_MACAROON_SECRET=${MACAROON_SECRET}"
echo "MATRIX_FORM_SECRET=${FORM_SECRET}"
echo "MATRIX_ADMIN_TOKEN=${ADMIN_TOKEN}"
echo "SYNAPSE_DB_PASSWORD=${SYNAPSE_DB_PASSWORD}"
echo "------------------------------------------------------------"
echo "After pasting, run: docker compose -f docker-compose.prod.yml up -d"
