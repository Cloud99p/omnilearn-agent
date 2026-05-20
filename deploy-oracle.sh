#!/bin/bash
# deploy-oracle.sh - Deploy to Oracle Cloud
# Usage: Run this ON the Oracle Cloud server

set -e

echo "🚀 Deploying to Oracle Cloud..."

cd /home/ubuntu/omnilearn-agent

# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Restart API
cd artifacts/api-server
pm2 restart omnilearn-api

# Save PM2 process list
pm2 save

echo ""
echo "✅ Deployment complete!"
echo "📊 Monitor: pm2 monit"
echo "📄 Logs: pm2 logs omnilearn-api"
