#!/bin/bash

# Direct Ollama installation and startup script for Replit Reserved VM
set -e

echo "🚀 Starting Kiteframe Ollama Service..."

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Set environment variables for external access
export OLLAMA_HOST=0.0.0.0
export OLLAMA_PORT=11434

# Start Ollama service in background
echo "🔧 Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to initialize..."
sleep 15

# Pull essential models for Kiteframe
echo "📥 Downloading AI models..."
ollama pull llama3.1:8b || echo "⚠️  Failed to pull llama3.1:8b"
ollama pull llama3.2:3b || echo "⚠️  Failed to pull llama3.2:3b"  
ollama pull mistral:7b || echo "⚠️  Failed to pull mistral:7b"
ollama pull phi3:mini || echo "⚠️  Failed to pull phi3:mini"

echo "✅ Kiteframe Ollama Service is ready!"
echo "🌐 Service available at: http://0.0.0.0:11434"
echo "🔗 API endpoint: http://0.0.0.0:11434/v1/chat/completions"

# Health check endpoint
echo "🏥 Running health check..."
curl -s http://localhost:11434/api/version && echo " - API responding correctly"

# Keep service running
wait $OLLAMA_PID