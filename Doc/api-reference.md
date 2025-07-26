# Cardinal API Reference

Complete API documentation for the Cardinal webhook service.

## 🔗 Base URL

```
http://localhost:3000
```

## 🔐 Authentication

All webhook endpoints (except health check) require authentication via the `X-Webhook-Secret` header.

```http
X-Webhook-Secret: your-webhook-secret-key
```

## 📋 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [ /* validation errors if applicable */ ]
}
```

## 🌡️ Health Check

### GET /health

Check the health status of the Cardinal service.

**Authentication**: Not required

#### Request
```http
GET /health HTTP/1.1
Host: localhost:3000
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "timestamp": "2025-01-26T10:00:00.000Z"
}
```

#### Example
```bash
curl -X GET http://localhost:3000/health
```

---

## 🛠️ Container Management

### POST /webhook/create-container

Create a new LXC container on Proxmox VE.

**Authentication**: Required

#### Request Body Schema

```json
{
  "name": "string",           // Required: Container name (3-50 chars)
  "hostname": "string",       // Required: Container hostname (3-50 chars, alphanumeric + hyphens)
  "cores": "number",          // Optional: CPU cores (1-16)
  "memory": "number",         // Optional: RAM in MB (512-32768)
  "disk": "number",           // Optional: Disk size in GB (4-500)
  "ostemplate": "string",     // Optional: OS template name
  "jenkins_job_id": "string", // Optional: Jenkins job identifier
  "additionalConfig": "object" // Optional: Additional Proxmox configuration
}
```

#### Request Example
```http
POST /webhook/create-container HTTP/1.1
Host: localhost:3000
Content-Type: application/json
X-Webhook-Secret: your-webhook-secret

{
  "name": "test-environment",
  "hostname": "test-env-01",
  "cores": 2,
  "memory": 2048,
  "disk": 10,
  "ostemplate": "ubuntu-22.04-standard_22.04-1_amd64.tar.zst",
  "jenkins_job_id": "build-123",
  "additionalConfig": {
    "net0": "name=eth0,bridge=vmbr0,ip=dhcp",
    "unprivileged": 1
  }
}
```

#### Success Response
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "container": {
    "id": 1,
    "ct_id": "101",
    "name": "test-environment",
    "hostname": "test-env-01",
    "username": "root",
    "status": "creating"
  },
  "message": "Container creation started successfully"
}
```

#### Field Descriptions

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `name` | string | ✅ | Human-readable container name | 3-50 characters |
| `hostname` | string | ✅ | Container hostname | 3-50 chars, alphanumeric + hyphens |
| `cores` | number | ❌ | CPU cores allocated | 1-16, default from env |
| `memory` | number | ❌ | RAM in megabytes | 512-32768, default from env |
| `disk` | number | ❌ | Disk size in gigabytes | 4-500, default from env |
| `ostemplate` | string | ❌ | Proxmox OS template | Valid template name |
| `jenkins_job_id` | string | ❌ | Jenkins job tracking ID | Any string |
| `additionalConfig` | object | ❌ | Extra Proxmox parameters | Valid Proxmox config |

#### Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "hostname",
      "message": "\"hostname\" must only contain alpha-numeric characters and hyphens"
    }
  ]
}
```

**Authentication Error (401)**
```json
{
  "success": false,
  "error": "Invalid webhook secret"
}
```

**Server Error (500)**
```json
{
  "success": false,
  "error": "Failed to create container: Proxmox connection timeout"
}
```

#### Code Examples

**cURL**
```bash
curl -X POST http://localhost:3000/webhook/create-container \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret-key" \
  -d '{
    "name": "my-test-container",
    "hostname": "test-ct-01",
    "cores": 2,
    "memory": 1024,
    "disk": 8
  }'
```

**JavaScript (Node.js)**
```javascript
const axios = require('axios');

const createContainer = async () => {
  try {
    const response = await axios.post('http://localhost:3000/webhook/create-container', {
      name: 'my-test-container',
      hostname: 'test-ct-01',
      cores: 2,
      memory: 1024,
      disk: 8
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      }
    });

    console.log('Container created:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

**Python**
```python
import requests
import json

def create_container():
    url = "http://localhost:3000/webhook/create-container"
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": "your-secret-key"
    }
    data = {
        "name": "my-test-container",
        "hostname": "test-ct-01",
        "cores": 2,
        "memory": 1024,
        "disk": 8
    }

    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 201:
        print("Container created:", response.json())
    else:
        print("Error:", response.json())
```

---

### POST /webhook/get-access

Retrieve access credentials for an existing container.

**Authentication**: Required

#### Request Body Schema

```json
{
  "ct_id": "string" // Required: Container ID from Proxmox
}
```

#### Request Example
```http
POST /webhook/get-access HTTP/1.1
Host: localhost:3000
Content-Type: application/json
X-Webhook-Secret: your-webhook-secret

{
  "ct_id": "101"
}
```

#### Success Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "access": {
    "ct_id": "101",
    "ip_address": "192.168.1.100",
    "username": "root",
    "password": "generated-secure-password"
  },
  "message": "Container access granted"
}
```

#### Error Responses

**Container Not Found (404)**
```json
{
  "success": false,
  "error": "Container not found"
}
```

**Container Not Running (400)**
```json
{
  "success": false,
  "error": "Container is not running"
}
```

#### Code Examples

**cURL**
```bash
curl -X POST http://localhost:3000/webhook/get-access \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret-key" \
  -d '{"ct_id": "101"}'
```

**JavaScript**
```javascript
const getContainerAccess = async (ctId) => {
  try {
    const response = await axios.post('http://localhost:3000/webhook/get-access', {
      ct_id: ctId
    }, {
      headers: {
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      }
    });

    return response.data.access;
  } catch (error) {
    throw new Error(error.response.data.error);
  }
};
```

---

### GET /webhook/containers

List all containers managed by Cardinal.

**Authentication**: Required

#### Request Example
```http
GET /webhook/containers HTTP/1.1
Host: localhost:3000
X-Webhook-Secret: your-webhook-secret
```

#### Success Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "containers": [
    {
      "id": 1,
      "ct_id": "101",
      "name": "test-environment",
      "ip_address": "192.168.1.100",
      "username": "root",
      "status": "running",
      "jenkins_job_id": "build-123",
      "created_at": "2025-01-26T10:00:00.000Z"
    },
    {
      "id": 2,
      "ct_id": "102",
      "name": "staging-env",
      "ip_address": "192.168.1.101",
      "username": "root",
      "status": "running",
      "jenkins_job_id": "build-124",
      "created_at": "2025-01-26T11:00:00.000Z"
    }
  ]
}
```

#### Container Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Internal database ID |
| `ct_id` | string | Proxmox container ID |
| `name` | string | Container display name |
| `ip_address` | string | Container IP address (null if not assigned) |
| `username` | string | Container username |
| `status` | string | Container status (creating, running, stopped) |
| `jenkins_job_id` | string | Associated Jenkins job ID |
| `created_at` | string | Creation timestamp (ISO 8601) |

#### Code Examples

**cURL**
```bash
curl -X GET http://localhost:3000/webhook/containers \
  -H "X-Webhook-Secret: your-secret-key"
```

**JavaScript**
```javascript
const listContainers = async () => {
  try {
    const response = await axios.get('http://localhost:3000/webhook/containers', {
      headers: {
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      }
    });

    return response.data.containers;
  } catch (error) {
    throw new Error(error.response.data.error);
  }
};
```

---

## 📊 Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Invalid or missing authentication |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error occurred |

## 🔄 Rate Limiting

Currently, no rate limiting is implemented. For production use, consider:
- Implementing rate limiting middleware
- Setting reasonable request limits per IP/user
- Adding request throttling for Proxmox API calls

## 📝 Request/Response Examples

### Complete Container Creation Flow

```bash
# 1. Create container
curl -X POST http://localhost:3000/webhook/create-container \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "name": "dev-environment",
    "hostname": "dev-env-01",
    "cores": 2,
    "memory": 2048,
    "jenkins_job_id": "dev-build-456"
  }'

# Response:
{
  "success": true,
  "container": {
    "id": 3,
    "ct_id": "103",
    "name": "dev-environment",
    "hostname": "dev-env-01",
    "username": "root",
    "status": "creating"
  },
  "message": "Container creation started successfully"
}

# 2. Wait for container to be ready (check status via list)
curl -X GET http://localhost:3000/webhook/containers \
  -H "X-Webhook-Secret: your-secret"

# 3. Get access when ready
curl -X POST http://localhost:3000/webhook/get-access \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{"ct_id": "103"}'

# Response:
{
  "success": true,
  "access": {
    "ct_id": "103",
    "ip_address": "192.168.1.103",
    "username": "root",
    "password": "SecureGeneratedPassword123"
  },
  "message": "Container access granted"
}
```

## 🚨 Error Handling Best Practices

### Client-Side Error Handling

```javascript
const handleApiResponse = async (apiCall) => {
  try {
    const response = await apiCall();

    if (!response.data.success) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      // API error response
      const { status, data } = error.response;

      switch (status) {
        case 400:
          console.error('Validation error:', data.details);
          break;
        case 401:
          console.error('Authentication failed');
          break;
        case 500:
          console.error('Server error:', data.error);
          break;
        default:
          console.error('Unexpected error:', data);
      }
    } else {
      // Network error
      console.error('Network error:', error.message);
    }

    throw error;
  }
};
```

### Retry Logic Example

```javascript
const createContainerWithRetry = async (containerData, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios.post('/webhook/create-container', containerData, {
        headers: { 'X-Webhook-Secret': process.env.WEBHOOK_SECRET }
      });
    } catch (error) {
      if (attempt === maxRetries || error.response?.status < 500) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
};
```

## 🔧 Advanced Configuration

### Custom OS Templates

When creating containers with custom OS templates:

```json
{
  "name": "custom-container",
  "hostname": "custom-ct",
  "ostemplate": "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst",
  "additionalConfig": {
    "net0": "name=eth0,bridge=vmbr1,ip=10.0.1.100/24,gw=10.0.1.1",
    "nameserver": "8.8.8.8",
    "searchdomain": "example.com"
  }
}
```

### Network Configuration

```json
{
  "additionalConfig": {
    "net0": "name=eth0,bridge=vmbr0,ip=dhcp",
    "net1": "name=eth1,bridge=vmbr1,ip=192.168.100.10/24"
  }
}
```

### Storage Configuration

```json
{
  "additionalConfig": {
    "rootfs": "local-lvm:20",
    "mp0": "/mnt/shared,mp=/mnt/shared,shared=1"
  }
}
```

This API reference provides comprehensive documentation for integrating with the Cardinal webhook service. For additional implementation details, refer to the other documentation files in this directory.
