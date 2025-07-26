# Cardinal Architecture Overview

## 🏗️ System Architecture

Cardinal is designed as a microservice-based webhook API that acts as a bridge between CI/CD systems (like Jenkins) and Proxmox VE infrastructure. The architecture follows a layered approach with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│     Jenkins     │   CI/CD Tools   │    External Systems         │
│   (Webhooks)    │   (REST API)    │    (Monitoring, etc.)       │
└─────────────────┴─────────────────┴─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  Express.js Server                                              │
│  ├── Routes (webhook.js)                                        │
│  ├── Middleware (auth, validation, error handling)              │
│  └── Controllers (webhookController.js)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Business Logic Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  Services                                                       │
│  ├── ContainerService.js (Container lifecycle management)       │
│  └── ProxmoxService.js (Proxmox API integration)               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Access Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  Models                                                         │
│  ├── Container.js (Container data model)                        │
│  ├── database.js (Database connection & initialization)         │
│  └── SQLite Database (Persistent storage)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                              │
│  ├── Proxmox VE API (Container creation & management)           │
│  ├── File System (Logs, Database)                              │
│  └── Network (HTTPS, API calls)                                │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Core Components

### 1. API Layer (Express.js)

**Location**: `src/index.js`, `src/routes/`, `src/controllers/`

**Responsibilities**:
- HTTP request handling
- Webhook authentication
- Input validation
- Response formatting
- Error handling

**Key Files**:
- `src/index.js`: Application bootstrap and server initialization
- `src/routes/webhook.js`: Route definitions and middleware application
- `src/controllers/webhookController.js`: Request processing and response generation

### 2. Business Logic Layer (Services)

**Location**: `src/services/`

**Responsibilities**:
- Container lifecycle management
- Proxmox API communication
- Business rule enforcement
- Data transformation

**Key Files**:
- `src/services/ContainerService.js`: High-level container operations
- `src/services/ProxmoxService.js`: Proxmox VE API integration

### 3. Data Access Layer (Models)

**Location**: `src/models/`

**Responsibilities**:
- Database schema management
- Data persistence
- Query abstraction
- Data encryption/decryption

**Key Files**:
- `src/models/Container.js`: Container data model and operations
- `src/models/database.js`: Database connection and initialization

### 4. Supporting Infrastructure

**Location**: `src/middleware/`, `src/utils/`, `src/config/`

**Responsibilities**:
- Cross-cutting concerns
- Utility functions
- Configuration management
- Logging and monitoring

## 🔄 Request Flow

### Container Creation Flow

```
1. Jenkins/CI Tool
   │
   ▼ POST /webhook/create-container
2. Express.js Router (webhook.js)
   │
   ▼ Apply middleware
3. Authentication Middleware (auth.js)
   │
   ▼ Validate webhook secret
4. Webhook Controller (webhookController.js)
   │
   ▼ Validate request data
5. Container Service (ContainerService.js)
   │
   ▼ Business logic
6. Proxmox Service (ProxmoxService.js)
   │
   ▼ API call
7. Proxmox VE Server
   │
   ▼ Container creation
8. Database Update (Container.js)
   │
   ▼ Store container info
9. Response to Client
```

### Detailed Flow Breakdown

#### 1. Request Reception
```javascript
// src/routes/webhook.js
router.post('/create-container', webhookController.createContainer.bind(webhookController));
```

#### 2. Authentication
```javascript
// src/middleware/auth.js
const webhookAuth = (req, res, next) => {
  const providedSecret = req.headers['x-webhook-secret'];
  // Validate against WEBHOOK_SECRET
};
```

#### 3. Validation
```javascript
// src/controllers/webhookController.js
const { error, value } = createContainerSchema.validate(req.body);
```

#### 4. Business Logic
```javascript
// src/services/ContainerService.js
async createContainer(requestData) {
  // Generate password, create container, store in DB
}
```

#### 5. Proxmox Integration
```javascript
// src/services/ProxmoxService.js
async createContainer(config) {
  // API call to Proxmox, wait for completion
}
```

#### 6. Data Persistence
```javascript
// src/models/Container.js
static async create(containerData) {
  // Store encrypted container data in SQLite
}
```

## 🏛️ Design Patterns

### 1. Service Layer Pattern
- **Purpose**: Encapsulate business logic
- **Implementation**: `ContainerService`, `ProxmoxService`
- **Benefits**: Testability, reusability, maintainability

### 2. Repository Pattern
- **Purpose**: Abstract data access
- **Implementation**: `Container` model with static methods
- **Benefits**: Database independence, testability

### 3. Middleware Pattern
- **Purpose**: Request/response processing pipeline
- **Implementation**: Express.js middleware stack
- **Benefits**: Separation of concerns, reusability

### 4. Factory Pattern
- **Purpose**: Object creation abstraction
- **Implementation**: Database connection creation
- **Benefits**: Flexibility, configuration management

## 🔧 Configuration Management

### Environment-Based Configuration
```javascript
// src/config/config.js
module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  proxmox: {
    host: process.env.PROXMOX_HOST,
    // ... other Proxmox settings
  }
};
```

### Configuration Layers
1. **Environment Variables**: Runtime configuration
2. **Config Files**: Application defaults
3. **Command Line Args**: Override mechanisms

## 🔒 Security Architecture

### Authentication Flow
```
Request → Webhook Secret Validation → Route Access → Business Logic
```

### Data Protection
- **Encryption**: AES-256-CBC for passwords
- **Hashing**: SHA-256 for sensitive data
- **Secure Storage**: Environment variables for secrets

### Network Security
- **HTTPS**: All external API calls
- **Input Validation**: Joi schemas
- **Error Handling**: No sensitive data in responses

## 📊 Data Flow

### Container Creation Data Flow
```
Input Data → Validation → Password Generation → Proxmox Creation →
Database Storage → Status Updates → Response
```

### Data Transformations
1. **Input**: Raw webhook data
2. **Validation**: Joi schema validation
3. **Enrichment**: Default values, generated passwords
4. **Encryption**: Password encryption before storage
5. **Storage**: Structured database records
6. **Output**: Formatted API responses

## 🚀 Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: No session state
- **Database**: Shared SQLite (consider PostgreSQL for multi-instance)
- **Load Balancing**: Round-robin request distribution

### Vertical Scaling
- **CPU**: Proxmox API calls are I/O bound
- **Memory**: Container data caching
- **Storage**: Database and log storage

### Performance Optimizations
- **Connection Pooling**: Proxmox API connections
- **Caching**: Container status caching
- **Async Processing**: Non-blocking operations

## 🔄 Error Handling Strategy

### Error Categories
1. **Validation Errors**: Client input issues
2. **Authentication Errors**: Security violations
3. **Business Logic Errors**: Application-specific issues
4. **Infrastructure Errors**: External service failures

### Error Propagation
```
Component Error → Service Layer → Controller → Error Middleware → Client Response
```

### Recovery Mechanisms
- **Retry Logic**: Proxmox API calls
- **Graceful Degradation**: Fallback behaviors
- **Circuit Breaker**: Prevent cascade failures

## 📈 Monitoring & Observability

### Logging Strategy
- **Structured Logging**: JSON format with Winston
- **Log Levels**: Error, Warn, Info, Debug
- **Context**: Request IDs, user context

### Metrics Collection
- **Application Metrics**: Container creation rate, success rate
- **System Metrics**: Memory, CPU, disk usage
- **Business Metrics**: Active containers, resource utilization

### Health Checks
- **Liveness**: Application responsiveness
- **Readiness**: External dependency health
- **Custom**: Business logic health

## 🔮 Extension Points

### Adding New Services
1. Create service class in `src/services/`
2. Implement standard patterns (async/await, error handling)
3. Add corresponding tests
4. Update documentation

### Adding New Endpoints
1. Define route in `src/routes/`
2. Create controller method
3. Add validation schema
4. Implement service logic
5. Add tests and documentation

### Database Extensions
1. Update schema in `src/models/database.js`
2. Add model methods in relevant model files
3. Handle migrations
4. Update related services

This architectural design ensures maintainability, scalability, and security while providing clear separation of concerns and extension points for future development.
