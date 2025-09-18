# KitelineAI - Ollama Service for Kiteframe

KitelineAI is the dedicated AI service that powers Kiteframe's workflow generation capabilities. It provides privacy-focused AI processing using Ollama models through an autoscale deployment.

## Overview

- **Service Name**: KitelineAI
- **Purpose**: AI backend for Kiteframe workflow editor
- **Models**: Llama 3.2 3B, Phi-3 Mini (optimized for fast startup)
- **Deployment**: Replit Autoscale (cost-optimized)
- **Privacy**: Data processed but never stored

## Quick Setup

1. **Create new Replit project** named "KitelineAI"
2. **Upload all files** from this setup folder
3. **Deploy with Autoscale** using the provided configuration
4. **Update Kiteframe** to connect to your KitelineAI service

## Files Included

- `start-service.sh` - Main startup script
- `.replit` - Replit configuration
- `replit.nix` - Dependencies
- `health-check.sh` - Service monitoring
- `DEPLOYMENT.md` - Detailed setup instructions

## Expected URL

After deployment, your service will be available at:
`https://kitelineai.replit.app`

## Integration

Once deployed, update Kiteframe to use your KitelineAI service endpoint for maximum privacy AI processing.