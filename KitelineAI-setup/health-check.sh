#!/bin/bash

# Health check script for KitelineAI service
echo "🔍 Checking KitelineAI service health..."

# Check if Ollama is responding
response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:11434/api/version)

if [ "$response" = "200" ]; then
    echo "✅ KitelineAI service is healthy and ready"
    
    # Check available models
    echo "📋 Available models:"
    curl -s http://localhost:11434/api/tags | head -20
    
    exit 0
else
    echo "❌ KitelineAI service is not responding (HTTP $response)"
    echo "💡 Service may be starting up or experiencing issues"
    exit 1
fi