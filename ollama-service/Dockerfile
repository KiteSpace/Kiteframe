# Dockerfile for Ollama service deployment on Replit Reserved VM
FROM ollama/ollama:latest

# Set environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

# Expose the port Ollama will run on
EXPOSE 11434

# Create directory for models
RUN mkdir -p /root/.ollama

# Copy startup script
COPY start-ollama.sh /start-ollama.sh
RUN chmod +x /start-ollama.sh

# Start Ollama service
CMD ["/start-ollama.sh"]