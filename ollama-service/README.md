# Kiteframe Ollama Service

This is a dedicated Ollama service for the Kiteframe workflow editor that runs on Replit Reserved VM Deployments.

## Features

- **Privacy-First**: Data is processed but never stored
- **Pre-loaded Models**: Includes Llama 3.1 8B, Llama 3.2 3B, Mistral 7B, and Phi-3 Mini
- **High Availability**: 99.9% uptime with Reserved VM infrastructure
- **OpenAI Compatible**: Uses standard OpenAI API format for easy integration

## Deployment

This service is designed to run on Replit Reserved VM Deployments for maximum reliability and performance.

### Reserved VM Deployment Steps:

1. **Create New Replit Project**: Import this folder as a new Replit project
2. **Open Deployments Tool**: Go to Tools > Deployments > Reserved VM
3. **Configure Machine**: Select appropriate CPU/RAM (recommend at least 4GB RAM for AI models)
4. **Set Domain**: Use `ollama` as subdomain (will be `ollama.replit.app`)
5. **App Type**: Select "Web server" and set port to 11434
6. **Build Command**: Leave empty (Docker handles the build)
7. **Run Command**: `bash start-ollama.sh`
8. **Deploy**: Click "Deploy" to start the service

### Environment Configuration:

- **Host**: 0.0.0.0 (to accept external connections)
- **Port**: 11434 (Ollama default)
- **Models**: Pre-loaded popular AI models for instant availability

## API Endpoints

Once deployed, the service will be available at:
- **Base URL**: `https://ollama.replit.app`
- **Chat Completions**: `https://ollama.replit.app/v1/chat/completions`
- **Models List**: `https://ollama.replit.app/v1/models`

## Usage with Kiteframe

In the Kiteframe workflow editor:
1. Open AI Settings
2. Select "Kiteframe (Managed Privacy)" provider
3. Choose from available models
4. Start generating workflows with complete privacy

## Security & Privacy

- No API keys required
- Data processed in real-time, never stored
- Dedicated infrastructure for privacy
- OpenAI-compatible API for seamless integration