#!/bin/bash
set -e

# --- Configuration ---
DOMAIN="app.konnecct.com"
EMAIL="your-email@example.com" # Change this!

echo "🚀 Starting Konnecct All-in-One Deployment on $DOMAIN..."
CRM_ROOT=$(pwd)

# Ensure no existing containers are blocking ports 80/443
docker compose -f docker-compose.prod.yml down || true
docker rm -f nginx-bootstrap 2>/dev/null || true

# 1. Ensure correct Node.js version (Rocket.Chat requires 22.16.0 exactly)
echo "🟢 Checking Node.js version..."
CURRENT_NODE=$(node -v)
if [ "$CURRENT_NODE" != "v22.16.0" ]; then
  echo "⚠️ Node version mismatch! (Found $CURRENT_NODE, need v22.16.0)"
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
    nvm install 22.16.0
    nvm use 22.16.0
  else
    echo "Installing NVM to manage Node versions..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22.16.0
    nvm use 22.16.0
  fi
fi

# Rocket.Chat is extremely strict about the node version, but 22.22.x is compatible with 22.16.x
# This will ignore minor version mismatches in Yarn 4.
export YARN_IGNORE_ENGINES=1

# Install system dependencies (required for node-canvas / high-end UI components)
echo "📦 Installing system dependencies (Cairo, Pango, SVG, Deno, unzip, etc.)..."
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev unzip

if ! [ -x "$(command -v deno)" ]; then
  echo "Installing Deno (required for Rocket.Chat Apps-Engine)..."
  curl -fsSL https://deno.land/install.sh | sh
  # Add to path for current session
  export DENO_INSTALL="$HOME/.deno"
  export PATH="$DENO_INSTALL/bin:$PATH"
fi

if ! [ -x "$(command -v meteor)" ]; then
  echo "Installing Meteor (required for Chat building)..."
  curl https://install.meteor.com/ | sh
fi

# 1.5 Install System Dependencies (req. for canvas/node-canvas)
echo "📦 Installing system dependencies (Cairo, Pango, SVG)..."
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# 2. Setup SSL directories
mkdir -p ./nginx/certbot-etc ./nginx/certbot-www

# 3. Request SSL Certificate (First Run)
echo "🔍 Checking for SSL certificates..."
if [ ! -d "./nginx/certbot-etc/live/$DOMAIN" ]; then
  echo "🔒 Bootstrapping SSL certificate for $DOMAIN..."
  
  # Download recommended SSL parameters
  if [ ! -f "./nginx/certbot-etc/options-ssl-nginx.conf" ]; then
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "./nginx/certbot-etc/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./nginx/certbot-etc/ssl-dhparams.pem"
  fi

  # 1. Start Nginx with bootstrap config
  docker run -d --name nginx-bootstrap -p 80:80 \
    -v "$(pwd)/nginx/nginx-bootstrap.conf:/etc/nginx/nginx.conf:ro" \
    -v "$(pwd)/nginx/certbot-www:/var/www/certbot:rw" \
    nginx:alpine

  # 2. Run Certbot
  docker run -it --rm --name certbot \
    -v "$(pwd)/nginx/certbot-etc:/etc/letsencrypt:rw" \
    -v "$(pwd)/nginx/certbot-www:/var/www/certbot:rw" \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    --email altamimi@konnecct.com --agree-tos --no-eff-email \
    -d $DOMAIN

  # 3. Cleanup bootstrap
  docker stop nginx-bootstrap && docker rm nginx-bootstrap
fi

# 4. Build Monorepo Dependencies (Shared -> UI -> Front)
echo "🧹 Cleaning old build artifacts..."
rm -rf packages/*/build packages/*/dist

echo "📦 Building Monorepo dependencies (PRODUCTION)..."
yarn install
NODE_ENV=production npx nx run-many -t build -p twenty-shared twenty-ui twenty-front --configuration=production

# 4.5 Build Rocket.Chat Mono-repo (Livechat, i18n, etc.)
echo "🚀 Building Rocket.Chat Sub-packages (Turbo)..."
cd ../Rocket.Chat
yarn install
yarn build

# Fix broken i18n symlinks (common in copied repos)
echo "🌐 Syncing Translations..."
rm -rf apps/meteor/packages/rocketchat-i18n/i18n
mkdir -p apps/meteor/packages/rocketchat-i18n/i18n
cp -r packages/i18n/src/locales/*.i18n.json apps/meteor/packages/rocketchat-i18n/i18n/ 2>/dev/null || true

echo "🚢 Building Rocket.Chat Bundle (Meteor)..."
cd apps/meteor
meteor build --server-only --directory .
cd "$CRM_ROOT"

# 5. Build and Launch
echo "🏗️ Building and Launching Docker Containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "✅ Deployment initiated! Access your app at https://$DOMAIN"
echo "Check logs: docker compose -f docker-compose.prod.yml logs -f"
