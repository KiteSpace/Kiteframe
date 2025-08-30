#!/bin/bash

# Start Ollama service in the background
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 10

# Pull the default models we want to support
echo "Pulling Ollama models..."
ollama pull llama3.1:8b
ollama pull llama3.2:3b
ollama pull mistral:7b
ollama pull phi3:mini

echo "Ollama service ready with models loaded!"

# Keep the container running
wait