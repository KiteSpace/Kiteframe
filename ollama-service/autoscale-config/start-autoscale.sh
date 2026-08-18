#!/bin/bash

# Autoscale-optimized Ollama startup script for Replit
set -e

echo "🚀 Starting Kiteframe Ollama Service (Autoscale Mode)..."

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
sleep 10

# Pre-pull essential small models only for faster cold starts
echo "📥 Downloading lightweight AI models for quick startup..."
ollama pull llama3.2:3b || echo "⚠️  Failed to pull llama3.2:3b"
ollama pull phi3:mini || echo "⚠️  Failed to pull phi3:mini"

# Larger models available on-demand
echo "📋 Larger models available on-demand: llama3.1:8b, mistral:7b"

echo "✅ Kiteframe Ollama Service is ready! (Autoscale Mode)"
echo "🌐 Service available at: http://0.0.0.0:11434"
echo "💡 Scales to zero after 15 minutes of inactivity"

# Health check endpoint
echo "🏥 Running health check..."
curl -s http://localhost:11434/api/version && echo " - API responding correctly"

# Keep service running
wait $OLLAMA_PID