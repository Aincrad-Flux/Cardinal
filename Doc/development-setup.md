# Cardinal Development Setup Guide

This guide will help you set up a local development environment for Cardinal.

## 📋 Prerequisites

### Required Software
- **Node.js**: Version 20 or higher
- **npm**: Version 8 or higher (comes with Node.js)
- **Git**: For version control
- **Docker**: For containerized development (optional)
- **Proxmox VE**: Access to a Proxmox server for testing

### System Requirements
- **OS**: Linux, macOS, or Windows with WSL2
- **RAM**: Minimum 4GB, recommended 8GB
- **Storage**: At least 2GB free space
- **Network**: Access to Proxmox VE server

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Cardinal
```

### 2. Install Dependencies
```bash
cd Cardinal
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 4. Configure Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Proxmox Configuration (Required)
PROXMOX_HOST=your-proxmox-server.com
PROXMOX_PORT=8006
PROXMOX_USERNAME=your-username
PROXMOX_PASSWORD=your-password
PROXMOX_NODE=your-node-name

# Container Defaults
CT_DEFAULT_OSTEMPLATE=ubuntu-22.04-standard_22.04-1_amd64.tar.zst
CT_DEFAULT_CORES=1
CT_DEFAULT_MEMORY=512
CT_DEFAULT_DISK=8
CT_DEFAULT_USERNAME=root
CT_DEFAULT_PASSWORD=development-password

# Security (Generate for development)
ENCRYPTION_KEY=dev-encryption-key-32-characters
JWT_SECRET=dev-jwt-secret-key
WEBHOOK_SECRET=dev-webhook-secret

# Database
DB_PATH=./data/cardinal.db
```

### 5. Start Development Server
```bash
npm run dev
```

### 6. Verify Installation
```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-26T10:00:00.000Z"}
```

## 📁 Project Structure

```
Cardinal/
├── src/                    # Source code
│   ├── config/            # Configuration files
│   │   └── config.js      # Environment configuration
│   ├── controllers/       # Request handlers
│   │   └── webhookController.js
│   ├── middleware/        # Express middleware
│   │   ├── auth.js        # Authentication
│   │   ├── errorHandler.js # Error handling
│   │   └── validation.js   # Request validation
│   ├── models/            # Data models
│   │   ├── Container.js   # Container model
│   │   └── database.js    # Database setup
│   ├── routes/            # API routes
│   │   └── webhook.js     # Webhook endpoints
│   ├── services/          # Business logic
│   │   ├── ContainerService.js
│   │   └── ProxmoxService.js
│   ├── utils/             # Utility functions
│   │   ├── crypto.js      # Encryption utilities
│   │   └── logger.js      # Logging setup
│   └── index.js           # Application entry point
├── data/                  # SQLite database (auto-created)
├── logs/                  # Application logs (auto-created)
├── Doc/                   # Documentation
├── .env.example           # Environment template
├── .gitignore            # Git ignore rules
├── docker-compose.yml    # Docker composition
├── Dockerfile            # Docker image definition
└── package.json          # Node.js dependencies
```

## 🔧 Development Scripts

### Available Commands
```bash
# Development server with auto-reload
npm run dev

# Production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Development Server Features
- **Auto-reload**: Server restarts on file changes
- **Debug logging**: Detailed logs in development
- **Console output**: Logs displayed in terminal
- **Error handling**: Detailed error messages

## 🧪 Testing Setup

### Testing Framework
Cardinal uses Jest for testing:

```bash
# Install test dependencies
npm install --save-dev jest supertest

# Run all tests
npm test

# Run specific test file
npm test -- ContainerService.test.js

# Run tests with coverage
npm run test:coverage
```

### Test Structure
```
tests/
├── unit/
│   ├── services/
│   │   ├── ContainerService.test.js
│   │   └── ProxmoxService.test.js
│   ├── models/
│   │   └── Container.test.js
│   └── utils/
│       └── crypto.test.js
├── integration/
│   ├── webhook.test.js
│   └── database.test.js
└── fixtures/
    ├── containers.json
    └── proxmox-responses.json
```

### Example Test
```javascript
// tests/unit/services/ContainerService.test.js
const ContainerService = require('../../../src/services/ContainerService');
const ProxmoxService = require('../../../src/services/ProxmoxService');
const Container = require('../../../src/models/Container');

// Mock dependencies
jest.mock('../../../src/services/ProxmoxService');
jest.mock('../../../src/models/Container');

describe('ContainerService', () => {
  let containerService;

  beforeEach(() => {
    containerService = new ContainerService();
    jest.clearAllMocks();
  });

  describe('createContainer', () => {
    it('should create container successfully', async () => {
      // Mock ProxmoxService response
      ProxmoxService.prototype.createContainer.mockResolvedValue({
        vmid: 101,
        hostname: 'test-ct'
      });

      // Mock Container model
      Container.create.mockResolvedValue({
        id: 1,
        ct_id: '101',
        name: 'test-container'
      });

      const result = await containerService.createContainer({
        name: 'test-container',
        hostname: 'test-ct'
      });

      expect(result.success).toBe(true);
      expect(result.container.ct_id).toBe(101);
      expect(ProxmoxService.prototype.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'test-ct'
        })
      );
    });

    it('should handle creation errors', async () => {
      ProxmoxService.prototype.createContainer.mockRejectedValue(
        new Error('Proxmox connection failed')
      );

      await expect(
        containerService.createContainer({
          name: 'test-container',
          hostname: 'test-ct'
        })
      ).rejects.toThrow('Failed to create container: Proxmox connection failed');
    });
  });
});
```

### Test Environment Configuration
Create a separate test environment:

```bash
# .env.test
NODE_ENV=test
DB_PATH=:memory:  # In-memory database for tests
PROXMOX_HOST=mock-proxmox
WEBHOOK_SECRET=test-webhook-secret
ENCRYPTION_KEY=test-encryption-key-32-characters
```

## 🗄️ Database Development

### Local Database Setup
The SQLite database is automatically created on first run:

```bash
# Database file location
./data/cardinal.db

# View database contents
sqlite3 ./data/cardinal.db

# Common SQLite commands
.tables                    # List tables
.schema containers         # View table schema
SELECT * FROM containers;  # View data
.quit                     # Exit
```

### Database Reset
```bash
# Stop the application
# Remove database file
rm ./data/cardinal.db

# Restart application (database will be recreated)
npm run dev
```

### Database Migrations
For schema changes:

1. Update `src/models/database.js`
2. Add migration logic
3. Test with fresh database
4. Update tests

## 🔍 Debugging

### Debug Configuration
```bash
# Enable debug logging
NODE_ENV=development

# Or set debug level explicitly
DEBUG=cardinal:*
```

### VS Code Debug Setup
Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Cardinal",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/Cardinal/src/index.js",
      "env": {
        "NODE_ENV": "development"
      },
      "envFile": "${workspaceFolder}/Cardinal/.env",
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon",
      "runtimeArgs": ["--exec"]
    }
  ]
}
```

### Common Debug Points
1. **Request Handling**: Controllers and middleware
2. **Business Logic**: Service methods
3. **Database Operations**: Model methods
4. **External API**: Proxmox service calls

### Logging in Development
```javascript
// src/utils/logger.js automatically configures for development
const logger = require('./utils/logger');

// In your code
logger.debug('Detailed debug information');
logger.info('General information');
logger.warn('Warning condition');
logger.error('Error occurred', error);
```

## 🐳 Docker Development

### Local Docker Development
```bash
# Build development image
docker build -t cardinal-dev .

# Run with development environment
docker run -d \
  --name cardinal-dev \
  -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  cardinal-dev

# View logs
docker logs -f cardinal-dev
```

### Docker Compose Development
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  cardinal-dev:
    build:
      context: ./Cardinal
      dockerfile: Dockerfile
    container_name: cardinal-dev
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    env_file:
      - ./Cardinal/.env
    volumes:
      - ./Cardinal/src:/app/src
      - ./Cardinal/data:/app/data
      - ./Cardinal/logs:/app/logs
    command: npm run dev
```

## 🔐 Security in Development

### Generate Development Keys
```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Development Security Checklist
- [ ] Use development-specific secrets
- [ ] Never commit real credentials
- [ ] Use test Proxmox instance
- [ ] Enable debug logging
- [ ] Test authentication flows

## 🌐 API Development

### Testing API Endpoints
```bash
# Test health check
curl http://localhost:3000/health

# Test webhook authentication
curl -X GET http://localhost:3000/webhook/containers \
  -H "X-Webhook-Secret: dev-webhook-secret"

# Create test container
curl -X POST http://localhost:3000/webhook/create-container \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: dev-webhook-secret" \
  -d '{
    "name": "dev-test",
    "hostname": "dev-test-01",
    "cores": 1,
    "memory": 512
  }'
```

### API Testing Tools
- **curl**: Command line testing
- **Postman**: GUI API testing
- **Insomnia**: Alternative API client
- **Thunder Client**: VS Code extension

### Postman Collection
Create a Postman collection with:
- Environment variables for base URL and secrets
- Pre-request scripts for authentication
- Test scripts for response validation

## 🔄 Development Workflow

### Feature Development
1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make Changes**
   - Update code
   - Add tests
   - Update documentation

3. **Test Changes**
   ```bash
   npm test
   npm run dev  # Test manually
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/new-feature
   ```

### Code Quality Checks
```bash
# Lint code
npm run lint

# Format code
npm run format

# Check types (if using TypeScript)
npm run type-check

# Run all quality checks
npm run check-all
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

#### Database Connection Issues
```bash
# Check database file permissions
ls -la ./data/

# Check disk space
df -h

# Reset database
rm ./data/cardinal.db
npm run dev
```

#### Proxmox Connection Issues
```bash
# Test connectivity
curl -k https://your-proxmox-host:8006/api2/json/version

# Check credentials
# Verify environment variables
echo $PROXMOX_HOST
```

#### Module Not Found
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

1. **Check Logs**: Look at console output and log files
2. **Review Documentation**: Check relevant doc files
3. **Test Isolation**: Test individual components
4. **Environment**: Verify environment variable configuration
5. **Dependencies**: Ensure all dependencies are installed

This development setup guide should get you started with Cardinal development. Remember to refer to other documentation files for specific component details.
