# Cardinal 🚀

**Cardinal** is a robust webhook-based service for automated Proxmox container management with Jenkins integration. It provides a secure API to create, manage, and access LXC containers on Proxmox VE through webhook calls.


## 🎯 Overview

Cardinal acts as a bridge between Jenkins CI/CD pipelines and Proxmox VE infrastructure, enabling automated provisioning of isolated development and testing environments. It's designed for DevOps teams who need on-demand container creation with secure access management.

### Key Use Cases
- **CI/CD Integration**: Automatically create containers for testing pipelines
- **Development Environments**: Provision isolated environments for developers
- **Testing Infrastructure**: Spin up containers for automated testing
- **Staging Environments**: Create staging environments on-demand

## ✨ Features

### Core Functionality
- **Automated Container Creation**: Create LXC containers via webhook calls
- **Secure Access Management**: Encrypted credential storage and secure access
- **Real-time Status Tracking**: Monitor container creation and status
- **Jenkins Integration**: Built-in support for Jenkins job tracking
- **IP Address Management**: Automatic IP discovery and tracking

### Security Features
- **Webhook Authentication**: Secret-based authentication for all API calls
- **Password Encryption**: AES-256-CBC encryption for stored passwords
- **Secure Logging**: Comprehensive logging without sensitive data exposure
- **Docker Security**: Non-root container execution

### Infrastructure Features
- **Proxmox VE Integration**: Direct API integration with Proxmox
- **SQLite Database**: Lightweight, embedded database for container tracking
- **Docker Support**: Containerized deployment with Docker Compose
- **Health Monitoring**: Built-in health checks and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│     Jenkins     │    │     Cardinal    │    │   Proxmox VE    │
│   (CI/CD Tool)  │────│   (Webhook API) │────│   (Hypervisor)  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                       ┌─────────────────┐
                       │                 │
                       │  SQLite Database│
                       │  (Container DB) │
                       │                 │
                       └─────────────────┘
```

### Component Overview
- **Express.js API**: RESTful webhook endpoints
- **Proxmox Service**: Direct integration with Proxmox VE API
- **Container Service**: Business logic for container lifecycle
- **Database Layer**: SQLite for persistent storage
- **Security Layer**: Authentication and encryption

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Access to a Proxmox VE server
- Basic understanding of webhooks and APIs

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Cardinal
```

### 2. Environment Configuration
```bash
# Copy the environment template
cp .env.example .env

# Edit the configuration
nano .env
```

### 3. Configure Environment Variables
```bash
# Proxmox Configuration
PROXMOX_HOST=your-proxmox-host.example.com
PROXMOX_USERNAME=your-username
PROXMOX_PASSWORD=your-password
PROXMOX_NODE=your-node-name

# Security Keys (generate strong random keys)
ENCRYPTION_KEY=your-32-character-encryption-key
WEBHOOK_SECRET=your-webhook-secret-key
```

### 4. Start the Service
```bash
# Start with Docker Compose
docker-compose up -d

# Verify the service is running
curl http://localhost:3000/health
```

## ⚙️ Configuration

### Environment Variables

#### Server Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Runtime environment | `production` | No |
| `PORT` | Server port | `3000` | No |

#### Proxmox Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PROXMOX_HOST` | Proxmox server hostname/IP | - | Yes |
| `PROXMOX_PORT` | Proxmox API port | `8006` | No |
| `PROXMOX_USERNAME` | Proxmox username | - | Yes |
| `PROXMOX_PASSWORD` | Proxmox password | - | Yes |
| `PROXMOX_NODE` | Proxmox node name | - | Yes |

#### Container Defaults
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CT_DEFAULT_OSTEMPLATE` | Default OS template | `ubuntu-22.04-standard_22.04-1_amd64.tar.zst` | No |
| `CT_DEFAULT_CORES` | Default CPU cores | `2` | No |
| `CT_DEFAULT_MEMORY` | Default RAM (MB) | `2048` | No |
| `CT_DEFAULT_DISK` | Default disk size (GB) | `8` | No |
| `CT_DEFAULT_USERNAME` | Default container username | `root` | No |
| `CT_DEFAULT_PASSWORD` | Default container password | - | Yes |

#### Security Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENCRYPTION_KEY` | 32-character encryption key | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `WEBHOOK_SECRET` | Webhook authentication secret | - | Yes |

### Database Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_PATH` | SQLite database file path | `/app/data/cardinal.db` | No |

## 📚 API Documentation

### Authentication
All API endpoints (except `/health`) require webhook authentication via the `X-Webhook-Secret` header:

```bash
curl -X POST http://localhost:3000/webhook/create-container \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-webhook-secret" \
  -d '{"name": "test-container", "hostname": "test-ct"}'
```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Prepare Environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

2. **Start Services**:
```bash
docker-compose up -d
```

3. **View Logs**:
```bash
docker-compose logs -f cardinal
```

4. **Stop Services**:
```bash
docker-compose down
```

### Manual Docker Build

```bash
# Build the image
cd Cardinal
docker build -t cardinal:latest .

# Run the container
docker run -d \
  --name cardinal-app \
  -p 3000:3000 \
  -v cardinal-data:/app/data \
  -v ./logs:/app/logs \
  --env-file .env \
  cardinal:latest
```

### Docker Compose Configuration

The `docker-compose.yml` includes:
- **Health Checks**: Automatic service health monitoring
- **Volume Persistence**: Data and logs persistence
- **Network Isolation**: Dedicated network for security
- **Restart Policy**: Automatic restart on failure

## 🔧 Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Access to Proxmox VE server

### Local Development Setup

1. **Install Dependencies**:
```bash
cd Cardinal
npm install
```

2. **Environment Setup**:
```bash
cp .env.example .env
# Configure your environment variables
```

3. **Start Development Server**:
```bash
npm run dev
```

### Project Structure
```
Cardinal/
├── src/
│   ├── config/          # Configuration management
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── index.js         # Application entry point
├── data/                # SQLite database (auto-created)
├── logs/                # Application logs
├── Dockerfile           # Docker configuration
├── package.json         # Node.js dependencies
└── .env.example         # Environment template
```

### Available Scripts
- `npm start`: Production server
- `npm run dev`: Development server with auto-reload
- `npm test`: Run tests (Jest)

### Development Guidelines

#### Code Style
- Use ES6+ features
- Follow async/await patterns
- Include comprehensive error handling
- Add logging for important operations

#### Database Migrations
The application automatically creates required tables on startup. For schema changes:
1. Update models in `src/models/`
2. Add migration logic in `database.js`
3. Test with a fresh database

#### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📊 Monitoring & Logging

### Health Monitoring
Cardinal includes built-in health checks:
- **HTTP Health Check**: `GET /health`
- **Docker Health Check**: Automatic container health monitoring
- **Database Connection**: Automatic database connectivity checks

### Logging

Cardinal uses Winston for structured logging:

#### Log Levels
- **Error**: System errors and failures
- **Warn**: Warning conditions
- **Info**: General operational messages
- **Debug**: Detailed debugging information (development only)

#### Log Files
- `logs/error.log`: Error-level messages only
- `logs/combined.log`: All log messages
- Console output (development mode only)

#### Log Structure
```json
{
  "level": "info",
  "message": "Container created successfully",
  "timestamp": "2025-01-26T10:00:00.000Z",
  "service": "cardinal",
  "metadata": {
    "vmid": "101",
    "hostname": "test-ct"
  }
}
```

### Monitoring Integration

For production deployments, consider integrating with:
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **ELK Stack**: Log aggregation and analysis
- **Alertmanager**: Alert notifications

## 🛠️ Troubleshooting

### Common Issues

#### Container Creation Fails
**Symptoms**: Container creation returns error
**Solutions**:
1. Check Proxmox credentials and connectivity
2. Verify OS template availability
3. Check resource availability on Proxmox node
4. Review logs for specific error details

```bash
# Check logs
docker-compose logs cardinal

# Test Proxmox connectivity
curl -k https://your-proxmox-host:8006/api2/json/version
```

#### Database Connection Issues
**Symptoms**: Database initialization fails
**Solutions**:
1. Check file permissions on data directory
2. Verify Docker volume mounts
3. Check available disk space

```bash
# Check data directory
ls -la ./data/

# Check Docker volumes
docker volume ls
```

#### Authentication Errors
**Symptoms**: 401 errors on API calls
**Solutions**:
1. Verify webhook secret configuration
2. Check request headers
3. Ensure environment variables are loaded

```bash
# Test webhook authentication
curl -X GET http://localhost:3000/webhook/containers \
  -H "X-Webhook-Secret: your-secret"
```

### Log Analysis

#### Enable Debug Logging
```bash
# Set environment variable
NODE_ENV=development

# Or in Docker Compose
environment:
  - NODE_ENV=development
```

#### Common Log Patterns
```bash
# Container creation logs
grep "Creating container" logs/combined.log

# Error patterns
grep "ERROR" logs/error.log

# Authentication attempts
grep "Webhook request" logs/combined.log
```

### Performance Issues

#### High Memory Usage
- Check for memory leaks in long-running processes
- Monitor container creation frequency
- Review database query performance

#### Slow Container Creation
- Check Proxmox server performance
- Verify network connectivity
- Review OS template size and availability

### Database Issues

#### Corrupt Database
```bash
# Backup current database
cp data/cardinal.db data/cardinal.db.backup

# Stop service
docker-compose down

# Remove database (will recreate on restart)
rm data/cardinal.db

# Restart service
docker-compose up -d
```

#### Database Migration
If schema changes are needed:
1. Stop the application
2. Backup the database
3. Update the database schema
4. Test with sample data
5. Deploy the changes

---

**Cardinal** - Empowering DevOps with automated container management 🚀
