#!/bin/bash
# deploy-hf.sh - Deploy to Hugging Face Spaces
# Usage: ./deploy-hf.sh

set -e

echo "🚀 Deploying to Hugging Face Spaces..."

# Ensure we're on main branch
git checkout main
git pull origin main

# Push to HF
git push hf main

echo ""
echo "✅ Deployment complete!"
echo "🌐 View at: https://huggingface.co/spaces/Emmanuel/omnilearn-agent"
echo "📊 Monitor at: Space Settings → Logs"
