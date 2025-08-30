# Kiteframe Ollama Service - Reserved VM Deployment Guide

This guide walks you through deploying the Kiteframe Ollama service on Replit Reserved VM for maximum privacy and reliability.

## 🚀 Quick Deployment Steps

### Step 1: Create the Ollama Service Project
1. Create a new Replit project
2. Upload all files from the `ollama-service/` folder
3. Ensure `start-direct.sh` has execute permissions

### Step 2: Configure Reserved VM Deployment
1. **Open Deployments**: In your Replit workspace, go to Tools → Deployments
2. **Select Reserved VM**: Choose "Reserved VM" deployment type
3. **Machine Configuration**: 
   - **Recommended**: 2 CPU cores, 4GB RAM (for multiple models)
   - **Minimum**: 1 CPU core, 2GB RAM (for single small model)
4. **Primary Domain**: Set subdomain to `ollama` (creates `ollama.replit.app`)
5. **App Type**: Select "Web server"
6. **Port Configuration**: Set port to `11434`
7. **Build Command**: Leave empty
8. **Run Command**: `bash start-direct.sh`

### Step 3: Deploy and Monitor
1. Click "Deploy" to start the Reserved VM
2. Monitor logs for model downloads (this takes 5-10 minutes initially)
3. Wait for "✅ Kiteframe Ollama Service is ready!" message
4. Test the deployment with the health check

## 🔧 Configuration Details

### Environment Variables
```bash
OLLAMA_HOST=0.0.0.0    # Accept external connections
OLLAMA_PORT=11434      # Standard Ollama port
```

### Pre-loaded Models
- **llama3.1:8b**: Best general-purpose model
- **llama3.2:3b**: Faster, lighter model  
- **mistral:7b**: Great for coding tasks
- **phi3:mini**: Smallest, fastest model

### API Endpoints
Once deployed, your service will be available at:
- **Base URL**: `https://ollama.replit.app`
- **Chat API**: `https://ollama.replit.app/v1/chat/completions`
- **Models**: `https://ollama.replit.app/v1/models`
- **Health**: `https://ollama.replit.app/api/version`

## 🧪 Testing Your Deployment

### Health Check
```bash
curl https://ollama.replit.app/api/version
```

### Test Chat Completion
```bash
curl -X POST https://ollama.replit.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'
```

## 💰 Cost Estimates

Reserved VM pricing (monthly):
- **2 CPU, 4GB RAM**: ~$25-35/month
- **1 CPU, 2GB RAM**: ~$15-20/month

Cost-effective for teams or high-usage scenarios compared to per-request API pricing.

## 🔧 Troubleshooting

### Common Issues
1. **Models not downloading**: Check RAM allocation (need 2GB+ per model)
2. **Connection refused**: Verify port 11434 is configured
3. **Slow responses**: Consider upgrading to more CPU cores

### Log Monitoring
Monitor deployment logs in Replit for:
- Ollama installation progress
- Model download status
- Service startup confirmation

## 🔒 Security & Privacy

- **No API keys required**: Direct access to your private instance
- **Data isolation**: Your own dedicated VM and models
- **No external data sharing**: All processing happens on your infrastructure
- **HTTPS encryption**: Automatic TLS for all communications

## 🔄 Updating Models

To add or update models, access your deployment and run:
```bash
ollama pull MODEL_NAME
```

Models persist across deployments due to Reserved VM's persistent storage.

## 📞 Support

If you encounter issues:
1. Check deployment logs in Replit
2. Verify machine specifications meet requirements
3. Test connectivity with health check endpoint
4. Contact Replit support for VM-specific issues