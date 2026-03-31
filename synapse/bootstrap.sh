#!/bin/bash
# =============================================================================
# Konnecct Matrix Bootstrap Script
# Run this ONCE on your Google Cloud VM after the first `docker compose up`.
# It provisions a Synapse admin account and prints the MATRIX_ADMIN_TOKEN
# you need to paste into your .env file.
# =============================================================================

set -e

# ─── Config ──────────────────────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.prod.yml"
SYNAPSE_CONTAINER="konnecctremake-synapse-1"
ADMIN_USERNAME="konnecct_admin"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Konnecct Matrix Bootstrap — Run Once Only          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── Step 0: Verify Synapse is running ───────────────────────────────────────
echo "[1/5] Checking Synapse container is healthy..."
if ! docker compose -f $COMPOSE_FILE ps synapse | grep -q "Up\|running"; then
  echo ""
  echo "  ✗ Synapse is not running. Start the stack first:"
  echo "    docker compose -f docker-compose.prod.yml up -d"
  exit 1
fi
echo "  ✓ Synapse is running."

# ─── Step 1: Generate secure secrets ─────────────────────────────────────────
echo ""
echo "[2/5] Generating secure secrets..."

REGISTRATION_SECRET=$(openssl rand -hex 32)
MACAROON_SECRET=$(openssl rand -hex 32)
FORM_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -hex 16)
SYNAPSE_DB_PASSWORD=$(openssl rand -hex 20)

echo "  ✓ Secrets generated."

# ─── Step 2: Update homeserver.yaml with real secrets ────────────────────────
echo ""
echo "[3/5] Injecting secrets into Synapse homeserver.yaml..."

# Replace the placeholder strings in homeserver.yaml with real values
# These sed commands update the mounted config file
sed -i "s|\${MATRIX_REGISTRATION_SHARED_SECRET}|${REGISTRATION_SECRET}|g" synapse/homeserver.yaml
sed -i "s|\${MATRIX_MACAROON_SECRET}|${MACAROON_SECRET}|g" synapse/homeserver.yaml
sed -i "s|\${MATRIX_FORM_SECRET}|${FORM_SECRET}|g" synapse/homeserver.yaml
sed -i "s|\${SYNAPSE_DB_PASSWORD:-synapse-pass}|${SYNAPSE_DB_PASSWORD}|g" synapse/homeserver.yaml

echo "  ✓ homeserver.yaml updated with real secrets."

# Restart Synapse to pick up the new homeserver.yaml values
echo "  → Restarting Synapse to apply config..."
docker compose -f $COMPOSE_FILE restart synapse
echo "  → Waiting 10 seconds for Synapse to come back online..."
sleep 10

# ─── Step 3: Create the admin account via shared-secret registration ──────────
echo ""
echo "[4/5] Provisioning the Matrix admin account (@${ADMIN_USERNAME})..."

# Get the registration nonce from Synapse
NONCE=$(docker compose -f $COMPOSE_FILE exec -T synapse \
  curl -s http://localhost:8008/_synapse/admin/v1/register | python3 -c "import sys,json; print(json.load(sys.stdin)['nonce'])")

if [ -z "$NONCE" ]; then
  echo "  ✗ Failed to get registration nonce from Synapse."
  echo "    Check: docker compose -f docker-compose.prod.yml logs synapse"
  exit 1
fi

# Generate the HMAC-SHA1 MAC using the shared secret
MAC=$(echo -n "${NONCE}\0${ADMIN_USERNAME}\0${ADMIN_PASSWORD}\0admin" | \
  openssl dgst -sha1 -hmac "${REGISTRATION_SECRET}" | awk '{print $2}')

# Register the admin account
REGISTER_RESULT=$(docker compose -f $COMPOSE_FILE exec -T synapse \
  curl -s -X POST http://localhost:8008/_synapse/admin/v1/register \
    -H "Content-Type: application/json" \
    -d "{\"nonce\":\"${NONCE}\",\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"mac\":\"${MAC}\",\"admin\":true}")

echo "  Registration result: $REGISTER_RESULT"

# Extract the access token
ADMIN_TOKEN=$(echo "$REGISTER_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','ERROR'))" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "ERROR" ]; then
  echo ""
  echo "  ✗ Admin registration failed. The account may already exist."
  echo "    If you have run this script before, skip to Step 4."
  echo "    To get a new admin token, run:"
  echo "      docker compose -f docker-compose.prod.yml exec synapse \\"
  echo "        register_new_matrix_user -c /data/homeserver.yaml \\"
  echo "        -u ${ADMIN_USERNAME} -p <password> -a http://localhost:8008"
  echo ""
else
  echo "  ✓ Admin account @${ADMIN_USERNAME} created successfully."
fi

# ─── Step 4: Print the .env block ─────────────────────────────────────────────
echo ""
echo "[5/5] Done! Copy the following block into your .env file on the VM:"
echo ""
echo "══════════ PASTE THIS INTO YOUR .env FILE ══════════"
echo ""
echo "# Matrix Communication Backend Secrets"
echo "MATRIX_REGISTRATION_SHARED_SECRET=${REGISTRATION_SECRET}"
echo "MATRIX_MACAROON_SECRET=${MACAROON_SECRET}"
echo "MATRIX_FORM_SECRET=${FORM_SECRET}"
echo "MATRIX_ADMIN_TOKEN=${ADMIN_TOKEN}"
echo "SYNAPSE_DB_PASSWORD=${SYNAPSE_DB_PASSWORD}"
echo ""
echo "════════════════════════════════════════════════════"
echo ""
echo "After pasting those values into your .env file, run:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Bootstrap complete! ✓"
