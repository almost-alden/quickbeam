# Use a lightweight Node.js Alpine base image
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production

# Set working directory inside the container
WORKDIR /app

# Copy dependency files first for optimal build caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code
COPY server.js registry.js deeplink.js ./
COPY public/ ./public/

# Cloud Run automatically sets the PORT env variable and expects the container to listen on it
ENV PORT=18000
EXPOSE 18000

# Start the Relay Server
CMD ["node", "server.js"]
