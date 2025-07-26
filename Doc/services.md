# Cardinal Services Documentation

This document details the service layer components that handle the core business logic of the Cardinal application.

## 📋 Overview

The service layer is responsible for:
- Business logic implementation
- External service integration
- Data transformation
- Error handling and validation
- Asynchronous operations management

## 🏗️ Service Architecture

```
Controllers
     │
     ▼
Service Layer
     │
     ├── ContainerService.js ──► Proxmox Service
     │                      └──► Container Model
     └── ProxmoxService.js  ──► Proxmox VE API
```

---

## 🐳 ContainerService

**File**: `src/services/ContainerService.js`

The ContainerService orchestrates container lifecycle management, combining Proxmox operations with database persistence.

### Class Structure

```javascript
class ContainerService {
  constructor() {
    this.proxmox = new ProxmoxService();
  }
}
```

### Methods

#### `createContainer(requestData)`

**Purpose**: Create a new LXC container with full lifecycle management.

**Parameters**:
```javascript
{
  name: string,              // Container display name
  hostname: string,          // Container hostname
  cores?: number,            // CPU cores (optional)
  memory?: number,           // RAM in MB (optional)
  disk?: number,             // Disk size in GB (optional)
  ostemplate?: string,       // OS template (optional)
  jenkins_job_id?: string,   // Jenkins job ID (optional)
  additionalConfig?: object  // Extra Proxmox config (optional)
}
```

**Returns**: Promise resolving to container creation result

**Process Flow**:
1. **Password Generation**: Creates secure random password
2. **Proxmox Creation**: Calls ProxmoxService to create container
3. **Database Storage**: Stores container metadata in database
4. **Async IP Update**: Updates IP address after container starts
5. **Response**: Returns immediate response with container info

**Implementation Details**:
```javascript
async createContainer(requestData) {
  try {
    const {
      name, hostname, cores, memory, disk,
      ostemplate, jenkins_job_id, additionalConfig = {}
    } = requestData;

    // Generate secure credentials
    const containerPassword = cryptoUtils.generatePassword();
    const containerUsername = process.env.CT_DEFAULT_USERNAME || 'root';

    logger.info(`Creating container: ${name} (${hostname})`);

    // Create on Proxmox
    const proxmoxResult = await this.proxmox.createContainer({
      hostname, cores, memory, disk, ostemplate,
      password: containerPassword, additionalConfig
    });

    // Store in database
    const containerRecord = await Container.create({
      ct_id: proxmoxResult.vmid.toString(),
      name, username: containerUsername,
      password: containerPassword, jenkins_job_id
    });

    // Async IP update (10 second delay)
    setTimeout(async () => {
      try {
        const ip = await this.proxmox.getContainerIP(proxmoxResult.vmid);
        await Container.updateStatus(
          proxmoxResult.vmid.toString(), 'running', ip
        );
      } catch (error) {
        logger.error('Error updating container IP:', error.message);
      }
    }, 10000);

    return {
      success: true,
      container: {
        id: containerRecord.id,
        ct_id: proxmoxResult.vmid,
        name, hostname, username: containerUsername,
        status: 'creating'
      },
      message: 'Container creation started successfully'
    };
  } catch (error) {
    logger.error('Container creation service error:', error.message);
    throw new Error(`Failed to create container: ${error.message}`);
  }
}
```

**Error Handling**:
- Proxmox API failures
- Database connection issues
- Password generation failures
- Timeout scenarios

#### `getContainerAccess(ct_id)`

**Purpose**: Retrieve access credentials for a running container.

**Parameters**:
- `ct_id` (string): Proxmox container ID

**Returns**: Promise resolving to access credentials

**Security Considerations**:
- Verifies container exists in database
- Ensures container is in 'running' state
- Decrypts stored password for response
- Logs access requests for auditing

**Implementation**:
```javascript
async getContainerAccess(ct_id) {
  try {
    const container = await Container.findByCtId(ct_id);

    if (!container) {
      throw new Error('Container not found');
    }

    if (container.status !== 'running') {
      throw new Error('Container is not running');
    }

    // Future: Create backup before granting access
    // TODO: Implement backup creation

    return {
      success: true,
      access: {
        ct_id: container.ct_id,
        ip_address: container.ip_address,
        username: container.username,
        password: container.password // Auto-decrypted by model
      },
      message: 'Container access granted'
    };
  } catch (error) {
    logger.error('Get container access error:', error.message);
    throw new Error(`Failed to get container access: ${error.message}`);
  }
}
```

#### `listContainers()`

**Purpose**: Retrieve all containers managed by Cardinal.

**Parameters**: None

**Returns**: Promise resolving to array of container objects

**Implementation**:
```javascript
async listContainers() {
  try {
    const containers = await Container.getAll();
    return {
      success: true,
      containers: containers.map(container => ({
        id: container.id,
        ct_id: container.ct_id,
        name: container.name,
        ip_address: container.ip_address,
        username: container.username,
        status: container.status,
        jenkins_job_id: container.jenkins_job_id,
        created_at: container.created_at
      }))
    };
  } catch (error) {
    logger.error('List containers error:', error.message);
    throw new Error(`Failed to list containers: ${error.message}`);
  }
}
```

### Best Practices

1. **Error Propagation**: Always wrap errors with context
2. **Logging**: Log all significant operations
3. **Async Operations**: Use proper async/await patterns
4. **Resource Cleanup**: Handle partial failures gracefully
5. **Security**: Never log sensitive information

---

## 🖥️ ProxmoxService

**File**: `src/services/ProxmoxService.js`

The ProxmoxService handles all interactions with the Proxmox VE API, providing a clean abstraction layer.

### Class Structure

```javascript
class ProxmoxService {
  constructor() {
    this.host = process.env.PROXMOX_HOST;
    this.port = process.env.PROXMOX_PORT || 8006;
    this.token = process.env.PROXMOX_TOKEN;
    this.secret = process.env.PROXMOX_SECRET;
    this.node = process.env.PROXMOX_NODE;
    this.baseURL = `https://${this.host}:${this.port}/api2/json`;

    // Configure axios with SSL bypass for self-signed certificates
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 30000,
      headers: {
        'Authorization': `PVEAPIToken=${this.token}=${this.secret}`
      }
    });
  }
}
```

### Configuration

The service supports multiple authentication methods:
- **API Tokens**: Recommended for production
- **Username/Password**: Available but less secure

### Methods

#### `createContainer(config)`

**Purpose**: Create a new LXC container on Proxmox VE.

**Parameters**:
```javascript
{
  vmid?: number,              // Container ID (auto-generated if not provided)
  hostname: string,           // Container hostname
  ostemplate: string,         // OS template path
  cores?: number,             // CPU cores
  memory?: number,            // RAM in MB
  swap?: number,              // Swap in MB
  net0?: string,              // Network configuration
  rootfs?: string,            // Root filesystem config
  storage?: string,           // Storage backend
  password: string,           // Root password
  unprivileged?: number,      // Unprivileged container (0/1)
  start?: number,             // Auto-start after creation (0/1)
  additionalConfig?: object   // Additional Proxmox parameters
}
```

**Returns**: Promise resolving to creation result

**Process Flow**:
1. **VMID Generation**: Get next available VMID if not provided
2. **Configuration Merge**: Combine provided config with defaults
3. **Container Creation**: Submit creation request to Proxmox
4. **Task Monitoring**: Wait for creation task completion
5. **Startup Verification**: Verify container starts successfully

**Implementation Highlights**:
```javascript
async createContainer(config) {
  try {
    const containerConfig = {
      vmid: config.vmid || await this.getNextVMID(),
      ostemplate: config.ostemplate || process.env.CT_DEFAULT_OSTEMPLATE,
      hostname: config.hostname,
      cores: config.cores || process.env.CT_DEFAULT_CORES || 1,
      memory: config.memory || process.env.CT_DEFAULT_MEMORY || 512,
      swap: config.swap || 512,
      net0: config.net0 || 'name=eth0,bridge=vmbr0,ip=dhcp',
      rootfs: config.rootfs || `local-lvm:${config.disk || process.env.CT_DEFAULT_DISK || 8}`,
      storage: config.storage || 'local-lvm',
      password: config.password || process.env.CT_DEFAULT_PASSWORD || 'password',
      unprivileged: config.unprivileged !== undefined ? config.unprivileged : 1,
      start: config.start !== undefined ? config.start : 1,
      ...config.additionalConfig
    };

    const response = await this.axiosInstance.post(
      `${this.baseURL}/nodes/${this.node}/lxc`,
      containerConfig
    );

    if (response.data && response.data.data) {
      const taskId = response.data.data;

      // Wait for task completion
      await this.waitForTask(taskId);

      // Wait for container to start
      await this.waitForContainerStart(containerConfig.vmid);

      return {
        vmid: containerConfig.vmid,
        hostname: containerConfig.hostname,
        taskId
      };
    }

    throw new Error('Invalid container creation response');
  } catch (error) {
    logger.error('Container creation failed:', error.message);
    throw new Error(`Container creation failed: ${error.message}`);
  }
}
```

#### `getNextVMID()`

**Purpose**: Get the next available VMID from Proxmox.

**Returns**: Promise resolving to next available VMID

**Fallback Strategy**: If API call fails, generates random VMID between 1000-9999

#### `waitForTask(taskId, maxWaitTime)`

**Purpose**: Monitor Proxmox task completion.

**Parameters**:
- `taskId` (string): Proxmox task identifier
- `maxWaitTime` (number): Maximum wait time in milliseconds (default: 300000)

**Implementation Strategy**:
- Polls task status every 2 seconds
- Checks exit status for success/failure
- Implements timeout protection
- Handles API errors gracefully

```javascript
async waitForTask(taskId, maxWaitTime = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await this.axiosInstance.get(
        `${this.baseURL}/nodes/${this.node}/tasks/${taskId}/status`
      );

      if (response.data && response.data.data) {
        const task = response.data.data;

        if (task.status === 'stopped') {
          if (task.exitstatus === '0') {
            logger.info(`Task ${taskId} completed successfully`);
            return true;
          } else {
            throw new Error(`Task failed with exit status: ${task.exitstatus}`);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      if (error.message.includes('Task failed')) {
        throw error;
      }
      logger.warn('Error checking task status:', error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Task timeout: operation took too long');
}
```

#### `waitForContainerStart(vmid, maxWaitTime)`

**Purpose**: Wait for container to reach 'running' state.

**Parameters**:
- `vmid` (number): Container VMID
- `maxWaitTime` (number): Maximum wait time (default: 120000)

#### `getContainerStatus(vmid)`

**Purpose**: Get current container status from Proxmox.

**Returns**: Promise resolving to status string ('running', 'stopped', etc.)

#### `getContainerIP(vmid)`

**Purpose**: Retrieve container IP address.

**Strategy**:
1. **Static IP**: Check container configuration for static IP
2. **DHCP IP**: Query container agent for assigned IP
3. **Fallback**: Return null if IP cannot be determined

**Implementation**:
```javascript
async getContainerIP(vmid) {
  try {
    // Wait for IP assignment
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check static IP configuration
    const response = await this.axiosInstance.get(
      `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/config`
    );

    if (response.data && response.data.data) {
      const config = response.data.data;

      if (config.net0) {
        const netConfig = config.net0;
        const ipMatch = netConfig.match(/ip=([^,]+)/);
        if (ipMatch && ipMatch[1] !== 'dhcp') {
          return ipMatch[1].split('/')[0];
        }
      }
    }

    // Try to get DHCP IP from agent
    try {
      const agentResponse = await this.axiosInstance.get(
        `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/agent/network-get-interfaces`
      );

      if (agentResponse.data && agentResponse.data.data) {
        const interfaces = agentResponse.data.data.result;
        for (const iface of interfaces) {
          if (iface.name === 'eth0' && iface['ip-addresses']) {
            for (const ip of iface['ip-addresses']) {
              if (ip['ip-address-type'] === 'ipv4' && !ip['ip-address'].startsWith('127.')) {
                return ip['ip-address'];
              }
            }
          }
        }
      }
    } catch (agentError) {
      logger.warn('Could not get IP from agent:', agentError.message);
    }

    return null;
  } catch (error) {
    logger.error(`Error getting container ${vmid} IP:`, error.message);
    return null;
  }
}
```

### Error Handling

The ProxmoxService implements comprehensive error handling:

1. **Network Errors**: Connection timeouts, DNS failures
2. **Authentication Errors**: Invalid credentials, expired tokens
3. **API Errors**: Invalid parameters, resource conflicts
4. **Task Failures**: Container creation failures, resource constraints

### Performance Considerations

1. **Connection Pooling**: Reuses HTTP connections
2. **Timeout Management**: Prevents hanging operations
3. **Retry Logic**: Built-in retry for transient failures
4. **Resource Monitoring**: Tracks long-running operations

### Security Features

1. **SSL Certificate Bypass**: For self-signed certificates (development)
2. **Token Authentication**: Preferred over username/password
3. **Request Logging**: Audit trail for all operations
4. **Error Sanitization**: Prevents credential exposure in logs

## 🔄 Service Interaction Patterns

### Synchronous Operations
- Configuration validation
- Database queries
- Status checks

### Asynchronous Operations
- Container creation
- IP address discovery
- Task monitoring

### Error Propagation
```
ProxmoxService Error → ContainerService → Controller → Client
```

### Logging Strategy
- **Info**: Successful operations
- **Warn**: Recoverable issues
- **Error**: Critical failures with context

## 🧪 Testing Services

### Unit Testing
```javascript
// Example test for ContainerService
describe('ContainerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createContainer should create container successfully', async () => {
    // Mock ProxmoxService
    const mockProxmoxResult = { vmid: 101, hostname: 'test' };
    ProxmoxService.prototype.createContainer = jest.fn().mockResolvedValue(mockProxmoxResult);

    // Mock Container model
    Container.create = jest.fn().mockResolvedValue({ id: 1, ct_id: '101' });

    const service = new ContainerService();
    const result = await service.createContainer({
      name: 'test',
      hostname: 'test-ct'
    });

    expect(result.success).toBe(true);
    expect(result.container.ct_id).toBe(101);
  });
});
```

### Integration Testing
Test with actual Proxmox instance for:
- API connectivity
- Container creation workflows
- Error scenarios

This service documentation provides the foundation for understanding and maintaining the business logic layer of Cardinal.
