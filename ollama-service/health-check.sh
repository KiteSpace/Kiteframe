#!/bin/bash

# Health check script for Ollama service
echo "Checking Ollama service health..."

# Check if Ollama is responding
response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:11434/api/version)

if [ "$response" = "200" ]; then
    echo "✅ Ollama service is healthy"
    exit 0
else
    echo "❌ Ollama service is not responding (HTTP $response)"
    exit 1
fi