#!/bin/bash
set -e

# --- Configuration ---
DOMAIN="app.konnecct.com"
EMAIL="your-email@example.com" # Change this!

echo "🚀 Starting Konnecct All-in-One Deployment on $DOMAIN..."

# 1. Install Docker & Compose if not present
if ! [ -x "$(command -v docker)" ]; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
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
echo "📦 Building Monorepo dependencies..."
yarn install
npx nx run-many -t build -p twenty-shared twenty-ui twenty-front

# 4.5 Build Rocket.Chat Bundle
echo "🚀 Building Rocket.Chat Bundle (Meteor)..."
cd ../Rocket.Chat
yarn install

# Fix broken i18n symlinks (common in copied repos)
echo "🌐 Syncing Translations..."
rm -rf apps/meteor/packages/rocketchat-i18n/i18n
mkdir -p apps/meteor/packages/rocketchat-i18n/i18n
cp -r packages/i18n/src/locales/*.i18n.json apps/meteor/packages/rocketchat-i18n/i18n/ 2>/dev/null || true

cd apps/meteor
meteor build --server-only --directory .
cd ../../KonnecctREMAKE

# 5. Build and Launch
echo "🏗️ Building and Launching Docker Containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "✅ Deployment initiated! Access your app at https://$DOMAIN"
echo "Check logs: docker compose -f docker-compose.prod.yml logs -f"
