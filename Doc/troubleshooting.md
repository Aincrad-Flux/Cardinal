# Cardinal Troubleshooting Guide

This guide helps diagnose and resolve common issues encountered when working with Cardinal.

## 🚨 Common Issues

### 1. Container Creation Failures

#### Symptoms
- HTTP 500 errors when creating containers
- "Container creation failed" messages
- Containers stuck in "creating" status

#### Diagnosis Steps
```bash
# Check Cardinal logs
docker-compose logs cardinal

# Look for Proxmox connection errors
grep -i "proxmox" logs/error.log

# Test Proxmox connectivity
curl -k https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/version
```

#### Common Causes & Solutions

**Proxmox Authentication Issues**
```bash
# Problem: 401 Unauthorized
# Check credentials
echo "Host: $PROXMOX_HOST"
echo "Token: $PROXMOX_TOKEN"
echo "Secret: $PROXMOX_SECRET"

# Test authentication
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/version
```

**Template Not Found**
```bash
# List available templates
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/aplinfo

# Update template name in environment
CT_DEFAULT_OSTEMPLATE=correct-template-name
```

**Resource Constraints**
```bash
# Check available storage
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/storage

# Check memory usage
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/status
```

**VMID Conflicts**
```bash
# List existing containers
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/lxc

# Check specific VMID
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/lxc/101/status/current
```

### 2. Authentication Failures

#### Symptoms
- HTTP 401 responses
- "Invalid webhook secret" messages
- "Webhook secret required" errors

#### Diagnosis Steps
```bash
# Check environment variables
env | grep WEBHOOK_SECRET

# Test webhook with curl
curl -X GET http://localhost:3000/webhook/containers \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET"

# Check logs for authentication attempts
grep "webhook" logs/combined.log
```

#### Solutions

**Missing Webhook Secret**
```bash
# Generate new webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update environment variable
export WEBHOOK_SECRET=your-new-secret
```

**Incorrect Header Format**
```bash
# Correct header format
X-Webhook-Secret: your-secret-value

# Not in request body for GET requests
```

### 3. Database Issues

#### Symptoms
- "Database connection failed" errors
- Missing container records
- Encrypted password errors

#### Diagnosis Steps
```bash
# Check database file exists
ls -la data/cardinal.db

# Check file permissions
stat data/cardinal.db

# Test database connectivity
sqlite3 data/cardinal.db "SELECT COUNT(*) FROM containers;"
```

#### Solutions

**Database File Missing**
```bash
# Stop application
docker-compose down

# Ensure data directory exists
mkdir -p data

# Start application (database will be created)
docker-compose up -d
```

**Permission Issues**
```bash
# Fix file permissions
chmod 660 data/cardinal.db
chown $USER:$USER data/cardinal.db

# Fix directory permissions
chmod 755 data/
```

**Encryption Key Issues**
```bash
# Check encryption key is set
echo $ENCRYPTION_KEY

# Key must be exactly 32 characters
# Generate new key if needed
openssl rand -hex 32
```

### 4. Network Connectivity Issues

#### Symptoms
- "Connection refused" errors
- Timeout errors
- "Cannot connect to Proxmox" messages

#### Diagnosis Steps
```bash
# Test basic connectivity
ping $PROXMOX_HOST

# Test port connectivity
telnet $PROXMOX_HOST 8006

# Check DNS resolution
nslookup $PROXMOX_HOST

# Test SSL connection
openssl s_client -connect $PROXMOX_HOST:8006
```

#### Solutions

**Firewall Issues**
```bash
# Check if port 8006 is open
nmap -p 8006 $PROXMOX_HOST

# Common Proxmox ports
# 22 - SSH
# 8006 - Web interface/API
# 3128 - SPICE proxy
```

**SSL Certificate Issues**
```bash
# For development: disable SSL verification
# In ProxmoxService.js:
httpsAgent: new https.Agent({
  rejectUnauthorized: false
})

# For production: add CA certificate
httpsAgent: new https.Agent({
  ca: fs.readFileSync('/path/to/ca-cert.pem')
})
```

### 5. Container IP Address Issues

#### Symptoms
- Containers have null IP addresses
- IP discovery timeouts
- Cannot connect to created containers

#### Diagnosis Steps
```bash
# Check container network configuration
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/lxc/101/config

# Check container status
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_TOKEN=$PROXMOX_SECRET" \
  https://$PROXMOX_HOST:$PROXMOX_PORT/api2/json/nodes/$PROXMOX_NODE/lxc/101/status/current
```

#### Solutions

**DHCP Issues**
```bash
# Check DHCP server configuration
# Verify bridge configuration in Proxmox
# Check network configuration:
net0: name=eth0,bridge=vmbr0,ip=dhcp
```

**Agent Not Running**
```bash
# Enable QEMU guest agent in container
# In Proxmox web interface:
# Container -> Options -> QEMU Guest Agent -> Enable
```

## 🔧 Debug Mode

### Enable Debug Logging

#### Environment Configuration
```bash
# Set debug environment
NODE_ENV=development
DEBUG=cardinal:*

# Or in Docker Compose
environment:
  - NODE_ENV=development
  - DEBUG=cardinal:*
```

#### Log Levels
```javascript
// In code, use appropriate log levels
logger.debug('Detailed debug information');
logger.info('General information');
logger.warn('Warning condition');
logger.error('Error occurred', error);
```

### Debug Endpoints

#### Health Check Debug
```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response
{
  "status": "ok",
  "timestamp": "2025-01-26T10:00:00.000Z"
}
```

#### Container List Debug
```bash
# Test authentication and database
curl -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  http://localhost:3000/webhook/containers
```

## 📊 Performance Issues

### Symptoms
- Slow container creation
- High memory usage
- Request timeouts

### Diagnosis

#### Memory Usage
```bash
# Check Docker container memory
docker stats cardinal-app

# Check Node.js memory
docker exec cardinal-app node -e "console.log(process.memoryUsage())"
```

#### Response Times
```bash
# Time API requests
time curl -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  http://localhost:3000/webhook/containers

# Check database query performance
sqlite3 data/cardinal.db ".timer on" "SELECT * FROM containers;"
```

### Solutions

#### Memory Optimization
```bash
# Set Node.js memory limits
NODE_OPTIONS="--max-old-space-size=512"

# Monitor for memory leaks
docker exec cardinal-app node -e "setInterval(() => console.log(process.memoryUsage()), 5000)"
```

#### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status);
CREATE INDEX IF NOT EXISTS idx_containers_created_at ON containers(created_at);

-- Analyze database
ANALYZE;

-- Vacuum database
VACUUM;
```

## 🔍 Log Analysis

### Log File Locations
```bash
# Cardinal application logs
logs/combined.log    # All log levels
logs/error.log       # Error level only

# Docker container logs
docker logs cardinal-app

# System logs (if running on host)
/var/log/cardinal/
```

### Common Log Patterns

#### Successful Container Creation
```
INFO: Creating container: test-container (test-ct)
INFO: Container creation task started: UPID:node:00001234:...
INFO: Task UPID:node:00001234:... completed successfully
INFO: Container 101 is running
INFO: Container 101 IP updated: 192.168.1.100
```

#### Authentication Success
```
INFO: Webhook request authenticated {
  "path": "/webhook/create-container",
  "method": "POST",
  "ip": "192.168.1.50"
}
```

#### Error Patterns
```
ERROR: Container creation failed: Proxmox connection timeout
ERROR: Database connection failed: SQLITE_CANTOPEN
WARN: Invalid webhook secret { "ip": "192.168.1.60" }
```

### Log Analysis Commands
```bash
# Recent errors
tail -100 logs/error.log

# Authentication failures
grep "Invalid webhook" logs/combined.log

# Container creation events
grep "Creating container" logs/combined.log

# IP address updates
grep "IP updated" logs/combined.log

# Performance monitoring
grep -E "(slow|timeout|delay)" logs/combined.log
```

## 🔧 Recovery Procedures

### Application Recovery

#### Service Restart
```bash
# Restart Docker container
docker-compose restart cardinal

# Full restart with rebuild
docker-compose down
docker-compose build
docker-compose up -d
```

#### Database Recovery
```bash
# Backup current database
cp data/cardinal.db data/cardinal.db.backup

# Check database integrity
sqlite3 data/cardinal.db "PRAGMA integrity_check;"

# Restore from backup if needed
cp data/cardinal.db.backup data/cardinal.db
```

### Configuration Reset

#### Environment Reset
```bash
# Reset to default configuration
cp .env.example .env

# Edit with correct values
nano .env

# Restart application
docker-compose restart cardinal
```

#### Container Cleanup
```bash
# Remove all containers and volumes
docker-compose down -v

# Remove images
docker rmi cardinal_cardinal

# Full restart
docker-compose up -d
```

## 📞 Getting Help

### Information to Gather

When seeking help, provide:

1. **Cardinal Version**: Check package.json
2. **Environment**: Development/Production, Docker version
3. **Error Messages**: Exact error text from logs
4. **Configuration**: Environment variables (without secrets)
5. **Steps to Reproduce**: What actions led to the issue

### Log Collection Script
```bash
#!/bin/bash
# collect-logs.sh

echo "Cardinal Troubleshooting Information"
echo "=================================="

echo "Date: $(date)"
echo "Cardinal Version: $(grep version Cardinal/package.json)"
echo "Docker Version: $(docker --version)"
echo "Docker Compose Version: $(docker-compose --version)"

echo ""
echo "Environment Variables:"
echo "====================="
env | grep -E "(NODE_ENV|PROXMOX_|CT_DEFAULT_)" | sed 's/=.*/=***/'

echo ""
echo "Container Status:"
echo "================"
docker-compose ps

echo ""
echo "Recent Logs:"
echo "============"
tail -50 logs/combined.log

echo ""
echo "Error Logs:"
echo "==========="
tail -20 logs/error.log
```

### Support Channels

1. **Documentation**: Check relevant documentation files
2. **Logs**: Review application and system logs
3. **GitHub Issues**: Create detailed issue reports
4. **Community**: Reach out to development team

Remember: Always sanitize logs and configuration before sharing, removing any sensitive information like passwords, tokens, or IP addresses.
