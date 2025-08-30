# KitelineAI Deployment Guide

Complete step-by-step guide to deploy KitelineAI as the AI backend for Driftline.

## 🚀 Step 1: Create KitelineAI Project

1. **Go to Replit** and create a new project
2. **Name it**: `KitelineAI` 
3. **Upload all files** from the KitelineAI-setup folder:
   - `start-service.sh`
   - `.replit`
   - `replit.nix` 
   - `health-check.sh`
   - This `DEPLOYMENT.md` file

## 🔧 Step 2: Configure Autoscale Deployment

1. **Open Deployments Tool**: Tools → Deployments
2. **Select Autoscale**: Choose "Autoscale" deployment type
3. **Configuration**:
   - **App Type**: Web server
   - **Port**: 11434
   - **Memory**: 8192 MiB (8GB) for larger models
   - **CPU**: 2 cores for better performance
   - **Build Command**: (leave empty)
   - **Run Command**: `bash start-service.sh`
4. **Deploy**: Click "Deploy" button

## ⏱️ Step 3: Wait for Initial Setup

**Important**: First deployment takes 5-10 minutes
- Ollama installation: ~2 minutes
- Model downloads: ~3-8 minutes  
- Service initialization: ~1 minute

**Monitor the logs** for these messages:
- `📦 Installing Ollama...`
- `📥 Loading AI models...`
- `✅ KitelineAI Service Ready!`

## 🧪 Step 4: Test Your Service

Once deployed at `https://kitelineai.replit.app`:

### Health Check
```bash
curl https://kitelineai.replit.app/api/version
```
**Expected**: JSON response with Ollama version

### Test AI Request
```bash
curl -X POST https://kitelineai.replit.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 20
  }'
```
**Expected**: JSON response with AI-generated text

## 🔗 Step 5: Connect Driftline

Update your Driftline application to use KitelineAI:
- Change Kiteframe endpoint from placeholder to `https://kitelineai.replit.app`
- Test "Kiteframe" provider in Driftline AI settings
- Generate a workflow to verify the connection

## 💰 Cost Optimization

**Autoscale Benefits**:
- **$0 when idle** (after 15 minutes)
- **~$0.10-0.50/hour** when active
- **Monthly cost**: $5-25 depending on usage

**Scale to zero**: Service automatically stops after 15 minutes of inactivity, saving costs.

## 🔧 Troubleshooting

### Service Not Responding
- **Check deployment logs** for errors
- **Verify port 11434** is configured correctly
- **Wait for models to download** on first run

### Slow First Response
- **Normal behavior**: 2-5 minutes for first request after idle
- **Models reload** on each cold start
- **Subsequent requests** are fast

### Model Download Failures
- **Check RAM allocation**: Ensure sufficient memory
- **Try smaller models**: phi3:mini requires less RAM
- **Restart deployment** if downloads fail

## 📊 Performance Expectations

### Cold Start (after idle)
- **Startup time**: 2-5 minutes
- **Model loading**: Included in startup
- **First response**: Available after startup

### Warm Service (active)
- **Response time**: 2-10 seconds
- **Concurrent requests**: Supported
- **Stay warm**: 15 minutes after last request

## 🔒 Privacy & Security

- **No data storage**: Requests processed and discarded
- **No API keys**: Direct service access
- **Dedicated infrastructure**: Your own service instance
- **HTTPS encryption**: All communications secured

## 📞 Support

If you encounter issues:
1. **Check deployment logs** in Replit
2. **Verify service health** with curl commands
3. **Monitor RAM usage** for model loading
4. **Restart deployment** if needed