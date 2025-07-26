# Use official Node.js runtime as the base image
FROM node:20-alpine

# Set working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY src/ ./src/

# Create data directory for SQLite database
RUN mkdir -p ./data

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cardinal -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R cardinal:nodejs /app

# Switch to non-root user
USER cardinal

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Command to run the application
CMD ["npm", "start"]