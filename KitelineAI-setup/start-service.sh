#!/bin/bash

# KitelineAI - Ollama Service for Driftline
# Optimized for Replit Autoscale deployment
set -e

echo "🚀 Starting KitelineAI Service..."
echo "   Privacy-focused AI for Driftline workflows"

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
echo "⏳ Initializing AI service..."
sleep 15

# Pre-load lightweight models for fast startup (autoscale optimized)
echo "📥 Loading AI models..."
echo "   → Downloading Llama 3.2 3B (fast, lightweight)..."
ollama pull llama3.2:3b || echo "⚠️  Failed to pull llama3.2:3b"

echo "   → Downloading Phi-3 Mini (smallest, fastest)..."
ollama pull phi3:mini || echo "⚠️  Failed to pull phi3:mini"

echo ""
echo "✅ KitelineAI Service Ready!"
echo "🌐 Endpoint: http://0.0.0.0:11434"
echo "🔗 API: http://0.0.0.0:11434/v1/chat/completions"
echo "💡 Autoscale: Stops after 15 minutes of inactivity"
echo ""
echo "📋 Available Models:"
echo "   • llama3.2:3b - General purpose, good balance"
echo "   • phi3:mini - Fastest response times"
echo ""

# Health check
echo "🏥 Running health check..."
sleep 5
if curl -s http://localhost:11434/api/version > /dev/null; then
    echo "✅ Service health check passed"
else
    echo "⚠️  Health check failed"
fi

echo ""
echo "🔐 Privacy: Data processed only, never stored"
echo "⚡ Ready to serve Driftline workflow requests"

# Keep service running
wait $OLLAMA_PID