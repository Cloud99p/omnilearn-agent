#!/bin/bash
# deploy-fly.sh - Deploy to Fly.io
# Usage: ./deploy-fly.sh

set -e

echo "🚀 Deploying to Fly.io..."

# Ensure we're on main branch
git checkout main
git pull origin main

# Deploy
fly deploy --remote-only

# Show status
fly status

# Show recent logs
fly logs --recent

echo ""
echo "✅ Deployment complete!"
echo "🌐 View at: https://omnilearn-agent.fly.dev"
echo "📊 Monitor at: fly dashboard"
