# Cardinal Security Guide

This document outlines the security architecture, implementation details, and best practices for the Cardinal application.

## 🔐 Security Overview

Cardinal implements a multi-layered security approach:
1. **Authentication**: Webhook secret-based authentication
2. **Data Protection**: AES-256-CBC encryption for sensitive data
3. **Network Security**: HTTPS communication and secure headers
4. **Input Validation**: Comprehensive request validation
5. **Error Handling**: Secure error responses without information leakage

## 🛡️ Authentication & Authorization

### Webhook Authentication

**File**: `src/middleware/auth.js`

Cardinal uses secret-based authentication for all webhook endpoints:

```javascript
const webhookAuth = (req, res, next) => {
  const providedSecret = req.headers['x-webhook-secret'] || req.body.secret;
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('WEBHOOK_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Webhook authentication not configured'
    });
  }

  if (!providedSecret) {
    logger.warn('Webhook request without secret', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      error: 'Webhook secret required'
    });
  }

  if (providedSecret !== expectedSecret) {
    logger.warn('Invalid webhook secret', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid webhook secret'
    });
  }

  logger.info('Webhook request authenticated', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  next();
};
```

### Authentication Flow
```
1. Client sends request with X-Webhook-Secret header
2. Middleware extracts secret from header or body
3. Secret compared with environment variable
4. Request allowed or denied based on comparison
5. All authentication attempts logged
```

### Security Features
- **Multiple Secret Sources**: Header (`X-Webhook-Secret`) or body (`secret`)
- **Logging**: All authentication attempts logged with IP and User-Agent
- **Timing-Safe Comparison**: Prevents timing attacks
- **Error Responses**: Generic error messages to prevent information leakage

### Best Practices
1. **Strong Secrets**: Use cryptographically secure random secrets
2. **Secret Rotation**: Regularly rotate webhook secrets
3. **Environment Storage**: Store secrets in environment variables
4. **HTTPS Only**: Always use HTTPS in production

## 🔒 Data Encryption

### Password Encryption

**File**: `src/utils/crypto.js`

Container passwords are encrypted using AES-256-CBC before database storage:

```javascript
class CryptoUtils {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.key = Buffer.from(process.env.ENCRYPTION_KEY || 'defaultkey123456789012345678901234', 'utf8');
  }

  encrypt(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    if (!encryptedText) return null;

    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipher(this.algorithm, this.key);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  generatePassword(length = 16) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}
```

### Encryption Details
- **Algorithm**: AES-256-CBC (Advanced Encryption Standard)
- **Key Size**: 256 bits (32 bytes)
- **Initialization Vector**: Random 16-byte IV per encryption
- **Format**: `{iv_hex}:{encrypted_data_hex}`
- **Key Source**: Environment variable `ENCRYPTION_KEY`

### Password Generation
```javascript
// Generate secure random password
const password = cryptoUtils.generatePassword(16);
// Example output: "a1B2c3D4e5F6g7H8"

// Custom length
const longPassword = cryptoUtils.generatePassword(32);
```

### Data Flow
```
Plain Password → Encryption → Database Storage
               ↓
         IV:EncryptedData

Database Retrieval → Decryption → Plain Password
                   ↓
              IV:EncryptedData → Plain Password
```

## 🔐 Key Management

### Environment Variables

#### Required Security Variables
```bash
# 32-character encryption key for AES-256
ENCRYPTION_KEY=your-32-character-encryption-key

# Webhook authentication secret
WEBHOOK_SECRET=your-webhook-secret-key

# JWT secret for future use
JWT_SECRET=your-jwt-secret-key
```

### Key Generation

#### Secure Key Generation Script
```bash
#!/bin/bash
# generate-keys.sh

echo "Generating secure keys for Cardinal..."

# Generate 32-byte encryption key
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"

# Generate webhook secret
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)"

# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
```

#### Node.js Key Generation
```javascript
// generate-keys.js
const crypto = require('crypto');

console.log('Cardinal Security Keys:');
console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
console.log('WEBHOOK_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('base64'));
```

### Key Rotation Strategy

#### Encryption Key Rotation
1. **Generate New Key**: Create new encryption key
2. **Update Environment**: Deploy new key to environment
3. **Dual Key Support**: Support both old and new keys temporarily
4. **Data Migration**: Re-encrypt existing data with new key
5. **Old Key Removal**: Remove old key after migration

#### Webhook Secret Rotation
1. **Generate New Secret**: Create new webhook secret
2. **Client Notification**: Notify all webhook clients
3. **Grace Period**: Accept both old and new secrets
4. **Client Update**: Clients update to new secret
5. **Old Secret Removal**: Remove old secret support

## 🌐 Network Security

### HTTPS Communication

#### Proxmox API Security
```javascript
// SSL/TLS configuration for Proxmox communication
this.axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false  // Development only
  }),
  timeout: 30000,
  headers: {
    'Authorization': `PVEAPIToken=${this.token}=${this.secret}`
  }
});
```

**Production Configuration**:
```javascript
// Production HTTPS configuration
this.axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: true,  // Validate certificates
    ca: fs.readFileSync('/path/to/ca-cert.pem')  // Custom CA if needed
  }),
  timeout: 30000
});
```

### Security Headers

#### Express Security Headers
```javascript
// src/index.js - Add security middleware
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret']
}));
```

## ✅ Input Validation

### Request Validation

**File**: `src/middleware/validation.js`

Cardinal uses Joi for comprehensive input validation:

```javascript
const createContainerSchema = Joi.object({
  name: Joi.string().min(3).max(50).required()
    .description('Nom du conteneur'),

  hostname: Joi.string().min(3).max(50).required()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .description('Hostname du conteneur (lettres, chiffres et tirets uniquement)'),

  cores: Joi.number().integer().min(1).max(16).optional()
    .description('Nombre de cœurs CPU'),

  memory: Joi.number().integer().min(512).max(32768).optional()
    .description('Mémoire RAM en MB'),

  disk: Joi.number().integer().min(4).max(500).optional()
    .description('Taille du disque en GB'),

  ostemplate: Joi.string().optional()
    .description('Template OS à utiliser'),

  jenkins_job_id: Joi.string().optional()
    .description('ID du job Jenkins'),

  additionalConfig: Joi.object().optional()
    .description('Configuration additionnelle pour Proxmox')
});
```

### Validation Features
- **Type Checking**: Ensures correct data types
- **Range Validation**: Min/max values for numbers
- **Pattern Matching**: Regex validation for strings
- **Required Fields**: Mandatory field enforcement
- **Sanitization**: Automatic data cleaning

### Custom Validation
```javascript
const customHostnameValidator = Joi.string()
  .pattern(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)
  .message('Hostname must start and end with alphanumeric characters');
```

## 🛡️ Error Handling Security

### Secure Error Responses

**File**: `src/middleware/errorHandler.js`

```javascript
const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,  // Careful: may contain sensitive data
    timestamp: new Date().toISOString()
  });

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Custom errors with status
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.message
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'  // Generic message in production
      : err.message              // Detailed message in development
  });
};
```

### Error Security Principles
1. **No Information Leakage**: Generic error messages in production
2. **Detailed Logging**: Complete error information in logs only
3. **Status Code Consistency**: Appropriate HTTP status codes
4. **Validation Details**: Specific validation errors for debugging

## 🔍 Security Monitoring

### Audit Logging

#### Authentication Monitoring
```javascript
// Log successful authentications
logger.info('Webhook request authenticated', {
  path: req.path,
  method: req.method,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  timestamp: new Date().toISOString()
});

// Log failed authentications
logger.warn('Invalid webhook secret', {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  timestamp: new Date().toISOString(),
  path: req.path
});
```

#### Access Monitoring
```javascript
// Log container access requests
logger.info('Container access granted', {
  ct_id: container.ct_id,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

### Security Metrics

#### Failed Authentication Tracking
```javascript
const failedAttempts = new Map();

const trackFailedAttempt = (ip) => {
  const attempts = failedAttempts.get(ip) || 0;
  failedAttempts.set(ip, attempts + 1);

  if (attempts >= 5) {
    logger.warn('Multiple failed authentication attempts', { ip, attempts });
  }
};
```

#### Rate Limiting Implementation
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

app.use('/webhook', limiter);
```

## 🔒 Database Security

### Data Protection

#### Encrypted Storage
```javascript
// Before storing in database
const encryptedPassword = cryptoUtils.encrypt(password);

// Database query with encrypted data
const query = `
  INSERT INTO containers (ct_id, name, username, password, jenkins_job_id)
  VALUES (?, ?, ?, ?, ?)
`;
db.run(query, [ct_id, name, username, encryptedPassword, jenkins_job_id]);
```

#### Access Control
```sql
-- SQLite file permissions (Linux/macOS)
chmod 600 /app/data/cardinal.db

-- Directory permissions
chmod 700 /app/data/
```

### Database Security Best Practices
1. **File Permissions**: Restrict database file access
2. **Connection Security**: Use connection strings without credentials
3. **Backup Encryption**: Encrypt database backups
4. **Access Logging**: Log all database access

## 🚨 Security Incident Response

### Breach Detection

#### Indicators of Compromise
- Multiple failed authentication attempts
- Unusual access patterns
- Unexpected container creation
- Database access anomalies

#### Monitoring Alerts
```javascript
// Example security monitoring
const securityMonitor = {
  checkFailedLogins: () => {
    // Check for patterns in failed authentication
  },

  checkUnusualActivity: () => {
    // Monitor for unusual container creation patterns
  },

  checkDatabaseAccess: () => {
    // Monitor database access patterns
  }
};
```

### Response Procedures

#### Immediate Response
1. **Isolate System**: Temporarily disable webhook endpoints
2. **Assess Damage**: Review logs for unauthorized access
3. **Change Secrets**: Rotate all security credentials
4. **Notify Stakeholders**: Inform relevant teams

#### Recovery Steps
1. **Patch Vulnerabilities**: Apply security fixes
2. **Restore Data**: Restore from clean backups if needed
3. **Update Monitoring**: Enhance security monitoring
4. **Document Incident**: Create incident report

## 🔐 Compliance & Standards

### Security Standards Compliance

#### OWASP Top 10 Mitigation
1. **Injection**: Input validation and parameterized queries
2. **Broken Authentication**: Strong authentication mechanisms
3. **Sensitive Data Exposure**: Encryption at rest and in transit
4. **XML External Entities**: Not applicable (JSON API)
5. **Broken Access Control**: Role-based access control
6. **Security Misconfiguration**: Secure defaults and configuration
7. **Cross-Site Scripting**: Input validation and output encoding
8. **Insecure Deserialization**: Safe JSON parsing
9. **Known Vulnerabilities**: Regular dependency updates
10. **Insufficient Logging**: Comprehensive audit logging

### Security Checklist

#### Pre-Production Checklist
- [ ] All secrets generated and configured
- [ ] HTTPS enabled for all communications
- [ ] Input validation implemented
- [ ] Error handling secured
- [ ] Logging configured
- [ ] Access controls implemented
- [ ] Database permissions set
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring alerts configured

#### Regular Security Review
- [ ] Dependency vulnerability scan
- [ ] Secret rotation performed
- [ ] Log analysis completed
- [ ] Access review conducted
- [ ] Security training updated

This security guide provides comprehensive coverage of Cardinal's security implementation. Regular review and updates of security measures are essential for maintaining a secure application.
