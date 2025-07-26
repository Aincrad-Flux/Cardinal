# Cardinal Controllers Documentation

This document provides detailed information about the controller layer in Cardinal, which handles HTTP request processing and response generation.

## 📋 Overview

Controllers in Cardinal are responsible for:
- HTTP request handling and validation
- Request/response data transformation
- Business logic coordination via services
- Error handling and response formatting
- Authentication and authorization checks

## 🏗️ Controller Architecture

```
Request → Middleware → Controller → Service → Model → Database
                          ↓
Response ← Middleware ← Controller ← Service ← Model ← Database
```

The controller layer acts as the coordination point between HTTP requests and business logic.

## 🎮 WebhookController

**File**: `src/controllers/webhookController.js`

The WebhookController is the primary controller handling all webhook endpoints for container management.

### Class Structure

```javascript
class WebhookController {
  constructor() {
    this.containerService = new ContainerService();
  }

  // Bind methods to preserve 'this' context in routes
  // router.post('/create-container', webhookController.createContainer.bind(webhookController));
}
```

### Method Binding

Controllers use `.bind(this)` to ensure proper context when used as route handlers:

```javascript
// In routes/webhook.js
router.post('/create-container', webhookController.createContainer.bind(webhookController));
router.post('/get-access', webhookController.getContainerAccess.bind(webhookController));
router.get('/containers', webhookController.listContainers.bind(webhookController));
```

## 🔧 Controller Methods

### `createContainer(req, res, next)`

**Purpose**: Handle container creation requests from webhooks.

**Request Flow**:
1. Validate request body using Joi schema
2. Extract and sanitize input data
3. Call ContainerService to create container
4. Format and return response

**Implementation**:
```javascript
async createContainer(req, res, next) {
  try {
    // Validation using Joi schema
    const { error, value } = createContainerSchema.validate(req.body);
    if (error) {
      error.isJoi = true;  // Flag for error handler
      return next(error);
    }

    // Log request for audit
    logger.info('Webhook: Create container request', {
      name: value.name,
      hostname: value.hostname,
      jenkins_job_id: value.jenkins_job_id
    });

    // Delegate to service layer
    const result = await this.containerService.createContainer(value);

    // Return success response
    res.status(201).json(result);

  } catch (error) {
    // Pass errors to error handling middleware
    next(error);
  }
}
```

**Input Validation**:
- Uses `createContainerSchema` from validation middleware
- Validates required fields: `name`, `hostname`
- Validates optional fields with constraints
- Returns detailed validation errors

**Response Format**:
```json
{
  "success": true,
  "container": {
    "id": 1,
    "ct_id": "101",
    "name": "test-container",
    "hostname": "test-ct",
    "username": "root",
    "status": "creating"
  },
  "message": "Container creation started successfully"
}
```

**Error Handling**:
- Validation errors passed to error middleware
- Service errors propagated with context
- All errors logged with request details

### `getContainerAccess(req, res, next)`

**Purpose**: Provide access credentials for existing containers.

**Security Considerations**:
- Validates container exists and is running
- Logs access requests for auditing
- Returns decrypted credentials

**Implementation**:
```javascript
async getContainerAccess(req, res, next) {
  try {
    // Validate request body
    const { error, value } = getAccessSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    // Log access request
    logger.info('Webhook: Get container access request', {
      ct_id: value.ct_id
    });

    // Get access from service
    const result = await this.containerService.getContainerAccess(value.ct_id);

    res.json(result);

  } catch (error) {
    next(error);
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "access": {
    "ct_id": "101",
    "ip_address": "192.168.1.100",
    "username": "root",
    "password": "decrypted-password"
  },
  "message": "Container access granted"
}
```

### `listContainers(req, res, next)`

**Purpose**: Return list of all managed containers.

**Implementation**:
```javascript
async listContainers(req, res, next) {
  try {
    logger.info('Webhook: List containers request');

    const result = await this.containerService.listContainers();

    res.json(result);

  } catch (error) {
    next(error);
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "containers": [
    {
      "id": 1,
      "ct_id": "101",
      "name": "test-container",
      "ip_address": "192.168.1.100",
      "username": "root",
      "status": "running",
      "jenkins_job_id": "build-123",
      "created_at": "2025-01-26T10:00:00.000Z"
    }
  ]
}
```

### `healthCheck(req, res)`

**Purpose**: Provide application health status (no authentication required).

**Implementation**:
```javascript
async healthCheck(req, res) {
  res.json({
    success: true,
    message: 'Cardinal webhook service is running',
    timestamp: new Date().toISOString()
  });
}
```

**Features**:
- No authentication required
- Simple health indicator
- Timestamp for monitoring
- Can be extended with detailed health checks

## 🔒 Authentication Integration

### Middleware Application

Controllers rely on authentication middleware applied at the route level:

```javascript
// src/routes/webhook.js
const { webhookAuth } = require('../middleware/auth');

// Health check without authentication
router.get('/health', webhookController.healthCheck.bind(webhookController));

// Apply authentication to protected routes
router.use(webhookAuth);

// Protected routes
router.post('/create-container', webhookController.createContainer.bind(webhookController));
router.post('/get-access', webhookController.getContainerAccess.bind(webhookController));
router.get('/containers', webhookController.listContainers.bind(webhookController));
```

### Authentication Context

Once authenticated, controllers have access to request context:

```javascript
// Available in req object after authentication
req.ip              // Client IP address
req.get('User-Agent')  // Client user agent
req.path            // Request path
req.method          // HTTP method
```

## ✅ Input Validation

### Validation Schemas

Controllers use Joi schemas defined in `src/middleware/validation.js`:

```javascript
const { createContainerSchema, getAccessSchema } = require('../middleware/validation');

// Validation in controller
const { error, value } = createContainerSchema.validate(req.body);
if (error) {
  error.isJoi = true;  // Mark as validation error
  return next(error);  // Pass to error handler
}
```

### Validation Features

**Type Checking**:
```javascript
cores: Joi.number().integer().min(1).max(16).optional()
```

**Pattern Matching**:
```javascript
hostname: Joi.string().pattern(/^[a-zA-Z0-9-]+$/)
```

**Custom Messages**:
```javascript
name: Joi.string().min(3).max(50).required()
  .messages({
    'string.min': 'Container name must be at least 3 characters',
    'string.max': 'Container name cannot exceed 50 characters',
    'any.required': 'Container name is required'
  })
```

## 📝 Request/Response Patterns

### Standard Response Format

All controller responses follow a consistent format:

```javascript
// Success response
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}

// Error response (handled by error middleware)
{
  "success": false,
  "error": "Error description",
  "details": [ /* validation details if applicable */ ]
}
```

### HTTP Status Codes

Controllers use appropriate HTTP status codes:

```javascript
// Success responses
res.status(200).json(result);  // OK
res.status(201).json(result);  // Created

// Error responses (via error middleware)
400 - Bad Request (validation errors)
401 - Unauthorized (authentication failures)
404 - Not Found (resource not found)
500 - Internal Server Error (application errors)
```

### Response Headers

Standard headers are set automatically:

```javascript
Content-Type: application/json
X-Powered-By: Express (or custom header)
```

## 🔍 Logging and Monitoring

### Request Logging

Controllers log significant operations:

```javascript
// Log request initiation
logger.info('Webhook: Create container request', {
  name: value.name,
  hostname: value.hostname,
  jenkins_job_id: value.jenkins_job_id,
  ip: req.ip,
  userAgent: req.get('User-Agent')
});

// Log request completion
logger.info('Container creation completed', {
  ct_id: result.container.ct_id,
  duration: Date.now() - startTime
});
```

### Error Logging

Errors are logged by the error handling middleware:

```javascript
// Error middleware logs full context
logger.error('Error occurred:', {
  message: err.message,
  stack: err.stack,
  url: req.url,
  method: req.method,
  body: req.body,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

### Performance Monitoring

Controllers can include performance tracking:

```javascript
async createContainer(req, res, next) {
  const startTime = Date.now();

  try {
    // ... controller logic

    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      path: req.path,
      method: req.method,
      duration: duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Request failed', {
      path: req.path,
      method: req.method,
      duration: duration,
      error: error.message
    });
    next(error);
  }
}
```

## 🧪 Testing Controllers

### Unit Testing

Controllers should be tested in isolation:

```javascript
// tests/unit/controllers/webhookController.test.js
const WebhookController = require('../../../src/controllers/webhookController');
const ContainerService = require('../../../src/services/ContainerService');

// Mock dependencies
jest.mock('../../../src/services/ContainerService');

describe('WebhookController', () => {
  let controller;
  let req, res, next;

  beforeEach(() => {
    controller = new WebhookController();

    req = {
      body: {},
      ip: '127.0.0.1',
      get: jest.fn(() => 'test-agent')
    };

    res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('createContainer', () => {
    it('should create container successfully', async () => {
      req.body = {
        name: 'test-container',
        hostname: 'test-ct'
      };

      const mockResult = {
        success: true,
        container: { ct_id: '101', name: 'test-container' }
      };

      ContainerService.prototype.createContainer.mockResolvedValue(mockResult);

      await controller.createContainer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      req.body = {
        name: 'ab'  // Too short
      };

      await controller.createContainer(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ isJoi: true })
      );
    });
  });
});
```

### Integration Testing

Test controllers with full middleware stack:

```javascript
// tests/integration/webhook.test.js
const request = require('supertest');
const app = require('../../src/index');

describe('Webhook Endpoints', () => {
  describe('POST /webhook/create-container', () => {
    it('should create container with valid data', async () => {
      const response = await request(app)
        .post('/webhook/create-container')
        .set('X-Webhook-Secret', process.env.WEBHOOK_SECRET)
        .send({
          name: 'test-container',
          hostname: 'test-ct'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.container).toBeDefined();
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/webhook/create-container')
        .send({
          name: 'test-container',
          hostname: 'test-ct'
        });

      expect(response.status).toBe(401);
    });
  });
});
```

## 🚀 Extending Controllers

### Adding New Endpoints

To add new controller methods:

1. **Add method to controller**:
```javascript
async deleteContainer(req, res, next) {
  try {
    const { error, value } = deleteContainerSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    logger.info('Webhook: Delete container request', {
      ct_id: value.ct_id
    });

    const result = await this.containerService.deleteContainer(value.ct_id);
    res.json(result);

  } catch (error) {
    next(error);
  }
}
```

2. **Add validation schema**:
```javascript
// src/middleware/validation.js
const deleteContainerSchema = Joi.object({
  ct_id: Joi.string().required()
    .description('Container ID to delete')
});
```

3. **Add route**:
```javascript
// src/routes/webhook.js
router.delete('/container', webhookController.deleteContainer.bind(webhookController));
```

4. **Add service method**:
```javascript
// src/services/ContainerService.js
async deleteContainer(ct_id) {
  // Implementation
}
```

### Controller Best Practices

1. **Single Responsibility**: Each method handles one specific operation
2. **Error Handling**: Always use try/catch and pass errors to middleware
3. **Validation**: Validate all inputs using Joi schemas
4. **Logging**: Log important operations with context
5. **Status Codes**: Use appropriate HTTP status codes
6. **Response Format**: Maintain consistent response structure
7. **Method Binding**: Use .bind(this) for route handlers
8. **No Business Logic**: Delegate to service layer

This controller documentation provides the foundation for understanding and extending the request handling layer in Cardinal.
