# Cardinal Docker Configuration Documentation

This document provides comprehensive information about Cardinal's Docker setup, configuration, and deployment strategies.

## 🐳 Docker Overview

Cardinal is designed to run in containerized environments using Docker. The application includes:
- Multi-stage Dockerfile for optimized builds
- Docker Compose configuration for easy deployment
- Health checks and monitoring
- Volume management for data persistence
- Security best practices

## 📁 Docker Files Structure

```
Cardinal/
├── Dockerfile              # Main application container
├── docker-compose.yml      # Production deployment
├── .dockerignore          # Files excluded from build context
└── Docker/                # Additional Docker configurations
    ├── docker-compose.dev.yml    # Development environment
    └── docker-compose.prod.yml   # Production environment
```

## 🏗️ Dockerfile Analysis

### Multi-Stage Build

**File**: `Cardinal/Dockerfile`

```dockerfile
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
```

### Dockerfile Best Practices

#### Security Features
1. **Non-root User**: Application runs as `cardinal` user (UID 1001)
2. **Alpine Linux**: Minimal base image with reduced attack surface
3. **Dependency Isolation**: Only production dependencies installed
4. **Proper Permissions**: File ownership correctly set

#### Performance Optimizations
1. **Layer Caching**: Package installation separate from code copy
2. **Minimal Image**: Alpine-based Node.js image
3. **Production Dependencies**: `npm ci --only=production`
4. **Health Checks**: Built-in container health monitoring

#### Build Context Optimization

**File**: `Cardinal/.dockerignore`

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.example
.nyc_output
coverage
.DS_Store
*.log
logs
data
.vscode
.idea
```

## 🚀 Docker Compose Configuration

### Production Deployment

**File**: `docker-compose.yml`

```yaml
services:
  cardinal:
    build:
      context: ./Cardinal
      dockerfile: Dockerfile
    container_name: cardinal-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      # Proxmox Configuration
      - PROXMOX_HOST=${PROXMOX_HOST}
      - PROXMOX_PORT=${PROXMOX_PORT:-8006}
      - PROXMOX_USERNAME=${PROXMOX_USERNAME}
      - PROXMOX_PASSWORD=${PROXMOX_PASSWORD}
      - PROXMOX_NODE=${PROXMOX_NODE}
      # Container Defaults
      - CT_DEFAULT_OSTEMPLATE=${CT_DEFAULT_OSTEMPLATE:-ubuntu-22.04-standard_22.04-1_amd64.tar.zst}
      - CT_DEFAULT_CORES=${CT_DEFAULT_CORES:-2}
      - CT_DEFAULT_MEMORY=${CT_DEFAULT_MEMORY:-2048}
      - CT_DEFAULT_DISK=${CT_DEFAULT_DISK:-8}
      - CT_DEFAULT_USERNAME=${CT_DEFAULT_USERNAME:-root}
      - CT_DEFAULT_PASSWORD=${CT_DEFAULT_PASSWORD}
      # Security
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      # Database
      - DB_PATH=/app/data/cardinal.db
    volumes:
      - cardinal-data:/app/data
      - ./logs:/app/logs
    networks:
      - cardinal-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  cardinal-data:
    driver: local

networks:
  cardinal-network:
    driver: bridge
```

### Configuration Features

#### Environment Variables
- **Default Values**: Fallback values with `${VAR:-default}` syntax
- **Secrets Management**: Sensitive data via environment variables
- **Configuration Flexibility**: Runtime configuration without rebuilding

#### Volume Management
- **Data Persistence**: Named volume for SQLite database
- **Log Access**: Bind mount for log file access
- **Data Separation**: Database isolated from container lifecycle

#### Network Configuration
- **Isolated Network**: Custom bridge network for security
- **Port Mapping**: Standard HTTP port exposure
- **Service Discovery**: Container name resolution

#### Health Monitoring
- **Application Health**: Built-in health check endpoint
- **Docker Health**: Container-level health monitoring
- **Restart Policy**: Automatic restart on failure

## 🔧 Docker Commands

### Building the Image

#### Local Build
```bash
# Build image locally
cd Cardinal
docker build -t cardinal:latest .

# Build with specific tag
docker build -t cardinal:v1.0.0 .

# Build without cache
docker build --no-cache -t cardinal:latest .
```

#### Multi-platform Build
```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t cardinal:latest .
```

### Running Containers

#### Development Run
```bash
# Run with development configuration
docker run -d \
  --name cardinal-dev \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  cardinal:latest
```

#### Production Run with Docker Compose
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f cardinal

# Stop services
docker-compose down

# Restart specific service
docker-compose restart cardinal
```

### Container Management

#### Container Operations
```bash
# View running containers
docker ps

# View all containers
docker ps -a

# Access container shell
docker exec -it cardinal-app /bin/sh

# View container logs
docker logs -f cardinal-app

# Inspect container
docker inspect cardinal-app
```

#### Volume Management
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect cardinal_cardinal-data

# Backup volume
docker run --rm \
  -v cardinal_cardinal-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/cardinal-data-backup.tar.gz -C /data .

# Restore volume
docker run --rm \
  -v cardinal_cardinal-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/cardinal-data-backup.tar.gz -C /data
```

## 🔍 Health Checks

### Application Health Check

The Dockerfile includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"
```

### Docker Compose Health Check

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Health Check Parameters

| Parameter | Description | Value |
|-----------|-------------|-------|
| `interval` | Time between health checks | 30 seconds |
| `timeout` | Maximum time for health check | 10 seconds |
| `retries` | Number of consecutive failures before unhealthy | 3 |
| `start_period` | Grace period during container startup | 40 seconds |

### Custom Health Checks

#### Database Health Check
```javascript
// Custom health check with database verification
const healthCheck = async () => {
  try {
    // Check application health
    const appHealth = await checkApplicationHealth();

    // Check database connectivity
    const dbHealth = await checkDatabaseHealth();

    // Check external dependencies
    const proxmoxHealth = await checkProxmoxHealth();

    return {
      status: 'healthy',
      checks: {
        application: appHealth,
        database: dbHealth,
        proxmox: proxmoxHealth
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};
```

## 🔒 Security Configuration

### Container Security

#### User Security
```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cardinal -u 1001

# Set ownership
RUN chown -R cardinal:nodejs /app

# Switch to non-root user
USER cardinal
```

#### File System Security
```dockerfile
# Read-only root filesystem (optional)
# docker run --read-only -v /app/data:/app/data -v /tmp:/tmp cardinal:latest
```

#### Network Security
```yaml
# Custom network for isolation
networks:
  cardinal-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

### Secrets Management

#### Docker Secrets (Swarm)
```yaml
# docker-compose.yml for Docker Swarm
version: '3.8'

services:
  cardinal:
    image: cardinal:latest
    secrets:
      - webhook_secret
      - encryption_key
    environment:
      - WEBHOOK_SECRET_FILE=/run/secrets/webhook_secret
      - ENCRYPTION_KEY_FILE=/run/secrets/encryption_key

secrets:
  webhook_secret:
    external: true
  encryption_key:
    external: true
```

#### Environment File Security
```bash
# Secure .env file permissions
chmod 600 .env

# Exclude from version control
echo ".env" >> .gitignore
```

## 📊 Monitoring and Logging

### Container Monitoring

#### Resource Monitoring
```bash
# Monitor container resource usage
docker stats cardinal-app

# Continuous monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" cardinal-app
```

#### Log Monitoring
```bash
# Follow container logs
docker logs -f cardinal-app

# Filter logs by level
docker logs cardinal-app 2>&1 | grep ERROR

# Export logs
docker logs cardinal-app > cardinal-logs.txt
```

### Prometheus Monitoring Integration

#### Docker Compose with Monitoring
```yaml
version: '3.8'

services:
  cardinal:
    build: ./Cardinal
    # ... existing configuration

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - cardinal-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - cardinal-network

volumes:
  grafana-data:
```

### Log Aggregation

#### ELK Stack Integration
```yaml
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./monitoring/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

## 🚀 Production Deployment

### Production Considerations

#### Performance Optimization
```yaml
# Production docker-compose.yml optimizations
services:
  cardinal:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

#### Load Balancing
```yaml
# Multiple instance deployment
services:
  cardinal:
    deploy:
      replicas: 3
    # ... configuration

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - cardinal
```

### CI/CD Integration

#### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy Cardinal

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          docker build -t cardinal:latest ./Cardinal

      - name: Deploy to production
        run: |
          docker-compose -f docker-compose.prod.yml up -d
```

#### Docker Registry Push
```bash
# Tag for registry
docker tag cardinal:latest registry.example.com/cardinal:latest

# Push to registry
docker push registry.example.com/cardinal:latest

# Deploy from registry
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Troubleshooting

### Common Issues

#### Build Issues
```bash
# Problem: Build fails with dependency errors
# Solution: Clear npm cache and rebuild
docker build --no-cache -t cardinal:latest .

# Problem: Permission denied
# Solution: Check Dockerfile USER directive and file permissions
```

#### Runtime Issues
```bash
# Problem: Container exits immediately
# Check container logs
docker logs cardinal-app

# Problem: Health check fails
# Test health endpoint manually
docker exec cardinal-app curl http://localhost:3000/health
```

#### Volume Issues
```bash
# Problem: Data not persisting
# Check volume mounts
docker inspect cardinal-app | grep -A 20 Mounts

# Problem: Permission denied on volumes
# Fix volume permissions
docker exec -u root cardinal-app chown -R cardinal:nodejs /app/data
```

### Debugging Tools

#### Container Debugging
```bash
# Access container shell as root
docker exec -u root -it cardinal-app /bin/sh

# Check container processes
docker exec cardinal-app ps aux

# Check container network
docker exec cardinal-app netstat -tlnp

# Check environment variables
docker exec cardinal-app env
```

#### Network Debugging
```bash
# Check container network configuration
docker network ls
docker network inspect cardinal_cardinal-network

# Test connectivity between containers
docker exec cardinal-app ping other-container
```

This Docker documentation provides comprehensive guidance for containerizing, deploying, and managing Cardinal in Docker environments.
