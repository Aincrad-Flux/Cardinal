# Cardinal Proxmox Integration Documentation

This document provides detailed information about Cardinal's integration with Proxmox VE, including API usage, container management, and best practices.

## 🎯 Overview

Cardinal integrates with Proxmox VE through its REST API to provide automated LXC container management. The integration handles:
- Container creation and configuration
- Status monitoring and management
- Network and storage configuration
- Task tracking and completion monitoring

## 🔧 Proxmox VE Setup

### Prerequisites
- Proxmox VE 7.0 or higher
- API access enabled
- User account with container management permissions
- Network connectivity between Cardinal and Proxmox

### Authentication Methods

#### API Token Authentication (Recommended)
```bash
# Create API token in Proxmox web interface
# Navigate to: Datacenter > Permissions > API Tokens
# Create token with format: user@realm!tokenid

# Example configuration
PROXMOX_TOKEN=root@pam!cardinal-token
PROXMOX_SECRET=your-secret-value
```

#### Username/Password Authentication
```bash
# Legacy authentication method
PROXMOX_USERNAME=root@pam
PROXMOX_PASSWORD=your-password
```

### Required Permissions

#### Minimum User Permissions
```
# For user account used by Cardinal
/nodes/{node}/lxc     - VM.Allocate, VM.Config.Options, VM.Console
/storage/{storage}    - Datastore.Allocate
/pool/{pool}          - Pool.Allocate (if using resource pools)
```

#### API Token Privileges
```
# Required privileges for API token
VM.Allocate          - Create new containers
VM.Config.Options    - Configure container options
VM.Console           - Access container console
VM.Monitor           - Monitor container status
Datastore.Allocate   - Allocate storage space
```

## 🏗️ ProxmoxService Architecture

### Class Structure

**File**: `src/services/ProxmoxService.js`

```javascript
class ProxmoxService {
  constructor() {
    this.host = process.env.PROXMOX_HOST;
    this.port = process.env.PROXMOX_PORT || 8006;
    this.token = process.env.PROXMOX_TOKEN;
    this.secret = process.env.PROXMOX_SECRET;
    this.node = process.env.PROXMOX_NODE;
    this.baseURL = `https://${this.host}:${this.port}/api2/json`;

    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false  // For self-signed certificates
      }),
      timeout: 30000,
      headers: {
        'Authorization': `PVEAPIToken=${this.token}=${this.secret}`
      }
    });
  }
}
```

### Configuration Parameters

| Parameter | Description | Example | Required |
|-----------|-------------|---------|----------|
| `PROXMOX_HOST` | Proxmox server hostname/IP | `proxmox.example.com` | Yes |
| `PROXMOX_PORT` | Proxmox API port | `8006` | No (default: 8006) |
| `PROXMOX_TOKEN` | API token identifier | `root@pam!cardinal` | Yes |
| `PROXMOX_SECRET` | API token secret | `secret-value` | Yes |
| `PROXMOX_NODE` | Target Proxmox node | `proxmox-node-1` | Yes |

## 🐳 Container Creation Process

### Container Configuration

#### Basic Configuration
```javascript
const containerConfig = {
  vmid: 101,                              // Container ID
  hostname: 'test-container',             // Container hostname
  ostemplate: 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
  cores: 2,                               // CPU cores
  memory: 2048,                           // RAM in MB
  swap: 1024,                             // Swap in MB
  net0: 'name=eth0,bridge=vmbr0,ip=dhcp', // Network configuration
  rootfs: 'local-lvm:8',                  // Root filesystem (storage:size_GB)
  storage: 'local-lvm',                   // Default storage
  password: 'secure-password',            // Root password
  unprivileged: 1,                        // Unprivileged container
  start: 1                                // Start after creation
};
```

#### Advanced Network Configuration
```javascript
// Static IP configuration
net0: 'name=eth0,bridge=vmbr0,ip=192.168.1.100/24,gw=192.168.1.1'

// Multiple network interfaces
net0: 'name=eth0,bridge=vmbr0,ip=dhcp'
net1: 'name=eth1,bridge=vmbr1,ip=10.0.1.100/24'

// VLAN configuration
net0: 'name=eth0,bridge=vmbr0,tag=100,ip=dhcp'
```

#### Storage Configuration
```javascript
// Root filesystem with specific storage
rootfs: 'local-lvm:20'  // 20GB on local-lvm storage

// Additional mount points
mp0: '/mnt/data,mp=/mnt/data,size=50G'  // Additional storage mount

// Shared storage
mp1: '/mnt/shared,mp=/mnt/shared,shared=1'  // Shared directory
```

### Creation Workflow

#### Step-by-Step Process
```javascript
async createContainer(config) {
  try {
    // 1. Get next available VMID
    const vmid = config.vmid || await this.getNextVMID();

    // 2. Prepare container configuration
    const containerConfig = this.prepareConfig(config, vmid);

    // 3. Submit creation request to Proxmox
    const response = await this.axiosInstance.post(
      `${this.baseURL}/nodes/${this.node}/lxc`,
      containerConfig
    );

    // 4. Get task ID from response
    const taskId = response.data.data;

    // 5. Wait for task completion
    await this.waitForTask(taskId);

    // 6. Verify container startup
    await this.waitForContainerStart(vmid);

    // 7. Return result
    return {
      vmid: vmid,
      hostname: containerConfig.hostname,
      taskId: taskId
    };

  } catch (error) {
    logger.error('Container creation failed:', error.message);
    throw new Error(`Container creation failed: ${error.message}`);
  }
}
```

## 📊 Task Monitoring

### Proxmox Task System

Proxmox uses an asynchronous task system for long-running operations:

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

      // Wait 2 seconds before next check
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

### Task Status Values
- `running`: Task is currently executing
- `stopped`: Task has completed (check exitstatus)
- `queueing`: Task is waiting in queue

### Exit Status Codes
- `0`: Success
- `1`: General error
- `2`: Misuse of shell command
- `>2`: Specific error codes

## 🌐 Network Management

### IP Address Discovery

Cardinal attempts to retrieve container IP addresses through multiple methods:

```javascript
async getContainerIP(vmid) {
  try {
    // Wait for IP assignment
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Method 1: Check static IP configuration
    const configResponse = await this.axiosInstance.get(
      `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/config`
    );

    if (configResponse.data && configResponse.data.data) {
      const config = configResponse.data.data;

      if (config.net0) {
        const ipMatch = config.net0.match(/ip=([^,]+)/);
        if (ipMatch && ipMatch[1] !== 'dhcp') {
          return ipMatch[1].split('/')[0];  // Remove subnet mask
        }
      }
    }

    // Method 2: Query QEMU guest agent
    try {
      const agentResponse = await this.axiosInstance.get(
        `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/agent/network-get-interfaces`
      );

      if (agentResponse.data && agentResponse.data.data) {
        const interfaces = agentResponse.data.data.result;

        for (const iface of interfaces) {
          if (iface.name === 'eth0' && iface['ip-addresses']) {
            for (const ip of iface['ip-addresses']) {
              if (ip['ip-address-type'] === 'ipv4' &&
                  !ip['ip-address'].startsWith('127.')) {
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

### Network Configuration Examples

#### DHCP Configuration
```javascript
net0: 'name=eth0,bridge=vmbr0,ip=dhcp'
```

#### Static IP Configuration
```javascript
net0: 'name=eth0,bridge=vmbr0,ip=192.168.1.100/24,gw=192.168.1.1'
```

#### Multiple Interfaces
```javascript
// Primary interface (DHCP)
net0: 'name=eth0,bridge=vmbr0,ip=dhcp'

// Secondary interface (Static)
net1: 'name=eth1,bridge=vmbr1,ip=10.0.1.100/24'
```

#### VLAN Configuration
```javascript
net0: 'name=eth0,bridge=vmbr0,tag=100,ip=dhcp'
```

## 💾 Storage Management

### Storage Types

#### Local Storage
```javascript
rootfs: 'local:8'        // Local storage, 8GB
```

#### LVM Storage
```javascript
rootfs: 'local-lvm:8'    // LVM thin pool, 8GB
```

#### ZFS Storage
```javascript
rootfs: 'zfs-pool:8'     // ZFS dataset, 8GB
```

#### Shared Storage
```javascript
rootfs: 'shared-storage:8'  // Shared storage (NFS, Ceph, etc.)
```

### Mount Points

#### Additional Storage Volumes
```javascript
// Additional data volume
mp0: '/mnt/data,mp=/mnt/data,size=50G,backup=1'

// Shared directory
mp1: '/shared,mp=/mnt/shared,shared=1'

// Backup volume (excluded from backup)
mp2: '/tmp,mp=/tmp,size=10G,backup=0'
```

#### Mount Point Options
- `size`: Volume size (e.g., `10G`, `500M`)
- `backup`: Include in backups (0/1)
- `shared`: Shared mount point (0/1)
- `ro`: Read-only (0/1)

## 🔍 Container Status Management

### Status Monitoring

```javascript
async getContainerStatus(vmid) {
  try {
    const response = await this.axiosInstance.get(
      `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/status/current`
    );

    if (response.data && response.data.data) {
      return response.data.data.status;
    }

    return 'unknown';

  } catch (error) {
    logger.error(`Error getting container ${vmid} status:`, error.message);
    throw error;
  }
}
```

### Container States
- `running`: Container is active
- `stopped`: Container is stopped
- `paused`: Container is paused
- `suspended`: Container is suspended

### Container Operations

#### Start Container
```javascript
async startContainer(vmid) {
  const response = await this.axiosInstance.post(
    `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/status/start`
  );
  return response.data.data;  // Returns task ID
}
```

#### Stop Container
```javascript
async stopContainer(vmid) {
  const response = await this.axiosInstance.post(
    `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/status/stop`
  );
  return response.data.data;  // Returns task ID
}
```

#### Restart Container
```javascript
async restartContainer(vmid) {
  const response = await this.axiosInstance.post(
    `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/status/restart`
  );
  return response.data.data;  // Returns task ID
}
```

## 🗂️ OS Templates

### Template Management

#### List Available Templates
```javascript
async getTemplates() {
  const response = await this.axiosInstance.get(
    `${this.baseURL}/nodes/${this.node}/aplinfo`
  );
  return response.data.data;
}
```

#### Download Template
```javascript
async downloadTemplate(template) {
  const response = await this.axiosInstance.post(
    `${this.baseURL}/nodes/${this.node}/aplinfo`,
    { template: template }
  );
  return response.data.data;  // Returns task ID
}
```

### Common Templates

#### Ubuntu Templates
```
ubuntu-20.04-standard_20.04-1_amd64.tar.gz
ubuntu-22.04-standard_22.04-1_amd64.tar.zst
ubuntu-24.04-standard_24.04-1_amd64.tar.zst
```

#### Debian Templates
```
debian-11-standard_11.7-1_amd64.tar.zst
debian-12-standard_12.2-1_amd64.tar.zst
```

#### CentOS/AlmaLinux Templates
```
centos-8-default_20201210_amd64.tar.xz
almalinux-9-default_20221108_amd64.tar.xz
```

### Template Configuration
```javascript
// Specify template in container config
const containerConfig = {
  ostemplate: 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
  // ... other configuration
};
```

## ⚡ Performance Optimization

### Connection Management

#### HTTP Keep-Alive
```javascript
const https = require('https');

const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10
});

this.axiosInstance = axios.create({
  httpsAgent: agent,
  timeout: 30000
});
```

#### Request Timeout Configuration
```javascript
// Different timeouts for different operations
const timeouts = {
  status: 5000,      // Quick status checks
  create: 60000,     // Container creation
  task: 300000       // Long-running tasks
};
```

### Batch Operations

#### Multiple Container Creation
```javascript
async createMultipleContainers(containers) {
  const results = [];

  // Create containers in parallel (with concurrency limit)
  const concurrency = 3;
  for (let i = 0; i < containers.length; i += concurrency) {
    const batch = containers.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(config => this.createContainer(config))
    );
    results.push(...batchResults);
  }

  return results;
}
```

## 🚨 Error Handling

### Common Proxmox Errors

#### Authentication Errors
```
401 Unauthorized - Invalid credentials or token
403 Forbidden - Insufficient permissions
```

#### Resource Errors
```
400 Bad Request - Invalid parameter values
409 Conflict - VMID already exists
500 Internal Server Error - Proxmox internal error
```

#### Network Errors
```
ECONNREFUSED - Connection refused
ETIMEDOUT - Connection timeout
ENOTFOUND - DNS resolution failed
```

### Error Recovery Strategies

#### Retry Logic
```javascript
async createContainerWithRetry(config, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.createContainer(config);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      if (this.isRetryableError(error)) {
        const delay = Math.pow(2, attempt) * 1000;  // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;  // Don't retry non-retryable errors
      }
    }
  }
}

isRetryableError(error) {
  const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
  const retryableStatuses = [500, 502, 503, 504];

  return retryableCodes.includes(error.code) ||
         retryableStatuses.includes(error.response?.status);
}
```

#### Circuit Breaker Pattern
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF-OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```

## 🔧 Troubleshooting

### Common Issues

#### SSL Certificate Issues
```bash
# Problem: Self-signed certificate error
# Solution: Configure axios to accept self-signed certificates
httpsAgent: new https.Agent({
  rejectUnauthorized: false
})

# Production solution: Use proper certificates
httpsAgent: new https.Agent({
  rejectUnauthorized: true,
  ca: fs.readFileSync('/path/to/ca-cert.pem')
})
```

#### Permission Issues
```bash
# Problem: 403 Forbidden
# Check user permissions in Proxmox
# Ensure API token has required privileges
```

#### Resource Constraints
```bash
# Problem: Container creation fails
# Check available storage space
# Verify memory/CPU limits
# Check template availability
```

### Debugging Tools

#### API Testing
```bash
# Test Proxmox API connectivity
curl -k -H "Authorization: PVEAPIToken=user@realm!tokenid=secret" \
  https://proxmox-host:8006/api2/json/version

# List nodes
curl -k -H "Authorization: PVEAPIToken=user@realm!tokenid=secret" \
  https://proxmox-host:8006/api2/json/nodes

# Check container status
curl -k -H "Authorization: PVEAPIToken=user@realm!tokenid=secret" \
  https://proxmox-host:8006/api2/json/nodes/node-name/lxc/101/status/current
```

#### Log Analysis
```bash
# Cardinal logs
tail -f logs/combined.log | grep -i proxmox

# Proxmox logs
tail -f /var/log/pve/tasks/active

# System logs
journalctl -u pveproxy -f
```

This comprehensive Proxmox integration documentation should help developers understand and maintain the Cardinal-Proxmox integration effectively.
