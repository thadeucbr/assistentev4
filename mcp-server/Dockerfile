# Use Node.js LTS
FROM node:lts-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create directories for volumes
RUN mkdir -p logs temp_audio temp_calendar

# Expose port (will be overridden by environment variable)
EXPOSE ${MCP_PORT:-3001}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${MCP_PORT:-3001}/health || exit 1

# Start the server
CMD ["node", "http-server.js"]
