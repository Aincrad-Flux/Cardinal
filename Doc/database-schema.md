# Cardinal Database Schema Documentation

This document describes the database structure, relationships, and data management strategies used in Cardinal.

## 📋 Overview

Cardinal uses SQLite as its embedded database system for simplicity and portability. The database handles:
- Container metadata storage
- Credential management with encryption
- Backup tracking
- Audit logging

## 🗄️ Database Configuration

**File**: `src/models/database.js`

### Connection Setup
```javascript
const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'cardinal.db');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logger.error('Error opening database:', err);
        reject(err);
        return;
      }
      logger.info('Connected to SQLite database');
      createTables().then(resolve).catch(reject);
    });
  });
};
```

### Database Initialization
The database automatically creates required tables on first startup:
1. Creates data directory if it doesn't exist
2. Establishes SQLite connection
3. Creates all required tables
4. Sets up indexes and constraints

## 📊 Database Schema

### Tables Overview

```sql
-- Container management
containers
backups

-- Future extensions
audit_logs
configurations
```

## 🐳 Containers Table

**Purpose**: Store container metadata, credentials, and status information.

### Schema Definition
```sql
CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ct_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  ip_address TEXT,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT DEFAULT 'creating',
  jenkins_job_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Field Descriptions

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Internal unique identifier |
| `ct_id` | TEXT | UNIQUE, NOT NULL | Proxmox container ID (VMID) |
| `name` | TEXT | NOT NULL | Human-readable container name |
| `ip_address` | TEXT | NULL | Container IP address (populated after creation) |
| `username` | TEXT | NOT NULL | Container login username |
| `password` | TEXT | NOT NULL | Encrypted container password |
| `status` | TEXT | DEFAULT 'creating' | Container status |
| `jenkins_job_id` | TEXT | NULL | Associated Jenkins job identifier |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update time |

### Status Values
- `creating`: Container creation in progress
- `running`: Container is active and accessible
- `stopped`: Container is stopped
- `error`: Container creation or operation failed

### Indexes
```sql
-- Automatic indexes
CREATE UNIQUE INDEX idx_containers_ct_id ON containers(ct_id);
CREATE INDEX idx_containers_status ON containers(status);
CREATE INDEX idx_containers_jenkins_job_id ON containers(jenkins_job_id);
CREATE INDEX idx_containers_created_at ON containers(created_at);
```

### Data Security

#### Password Encryption
All passwords are encrypted using AES-256-CBC before storage:

```javascript
// Encryption (before database insert)
const encryptedPassword = cryptoUtils.encrypt(password);

// Decryption (after database retrieval)
row.password = cryptoUtils.decrypt(row.password);
```

#### Encryption Details
- **Algorithm**: AES-256-CBC
- **Key Source**: Environment variable `ENCRYPTION_KEY`
- **IV**: Random 16-byte initialization vector per password
- **Format**: `{iv_hex}:{encrypted_data_hex}`

### Sample Data
```sql
INSERT INTO containers VALUES (
  1,                                    -- id
  '101',                               -- ct_id
  'development-environment',           -- name
  '192.168.1.100',                    -- ip_address
  'root',                             -- username
  'a1b2c3d4e5f6...:encrypted_password', -- password (encrypted)
  'running',                          -- status
  'dev-build-123',                    -- jenkins_job_id
  '2025-01-26 10:00:00',             -- created_at
  '2025-01-26 10:05:00'              -- updated_at
);
```

## 💾 Backups Table

**Purpose**: Track container backups for audit and recovery purposes.

### Schema Definition
```sql
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id INTEGER,
  backup_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (container_id) REFERENCES containers (id)
)
```

### Field Descriptions

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Internal unique identifier |
| `container_id` | INTEGER | FOREIGN KEY | References containers.id |
| `backup_id` | TEXT | NOT NULL | Proxmox backup identifier |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Backup creation time |

### Relationships
```sql
-- One container can have many backups
containers (1) ──────── (N) backups
```

## 🔧 Database Operations

### Connection Management
```javascript
// Get database instance
const db = getDatabase();

// Database is shared across the application
// No connection pooling needed for SQLite
```

### Transaction Handling
```javascript
// Example transaction for complex operations
db.serialize(() => {
  db.run("BEGIN TRANSACTION");

  db.run("INSERT INTO containers ...", (err) => {
    if (err) {
      db.run("ROLLBACK");
      return;
    }

    db.run("INSERT INTO backups ...", (err) => {
      if (err) {
        db.run("ROLLBACK");
      } else {
        db.run("COMMIT");
      }
    });
  });
});
```

### Performance Optimizations

#### WAL Mode
```sql
PRAGMA journal_mode=WAL;
```
Benefits:
- Better concurrency
- Faster reads
- Atomic transactions

#### Synchronization
```sql
PRAGMA synchronous=NORMAL;
```
Balance between performance and durability.

## 📊 Data Access Patterns

### Container Model Operations

#### Create Container Record
```javascript
static async create(containerData) {
  const db = getDatabase();
  const { ct_id, name, username, password, jenkins_job_id } = containerData;

  const encryptedPassword = cryptoUtils.encrypt(password);

  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO containers (ct_id, name, username, password, jenkins_job_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(query, [ct_id, name, username, encryptedPassword, jenkins_job_id], function(err) {
      if (err) {
        logger.error('Error creating container record:', err);
        reject(err);
        return;
      }

      resolve({
        id: this.lastID,
        ct_id, name, username, jenkins_job_id
      });
    });
  });
}
```

#### Find Container by VMID
```javascript
static async findByCtId(ct_id) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM containers WHERE ct_id = ?';

    db.get(query, [ct_id], (err, row) => {
      if (err) {
        logger.error('Error finding container by CT ID:', err);
        reject(err);
        return;
      }

      if (row) {
        // Decrypt password before returning
        row.password = cryptoUtils.decrypt(row.password);
      }

      resolve(row);
    });
  });
}
```

#### Update Container Status
```javascript
static async updateStatus(ct_id, status, ip_address = null) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    let query = 'UPDATE containers SET status = ?, updated_at = CURRENT_TIMESTAMP';
    let params = [status];

    if (ip_address) {
      query += ', ip_address = ?';
      params.push(ip_address);
    }

    query += ' WHERE ct_id = ?';
    params.push(ct_id);

    db.run(query, params, function(err) {
      if (err) {
        logger.error('Error updating container status:', err);
        reject(err);
        return;
      }

      logger.info(`Container ${ct_id} status updated to: ${status}`);
      resolve(this.changes > 0);
    });
  });
}
```

#### List All Containers
```javascript
static async getAll() {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM containers ORDER BY created_at DESC';

    db.all(query, [], (err, rows) => {
      if (err) {
        logger.error('Error getting all containers:', err);
        reject(err);
        return;
      }

      // Decrypt passwords for all containers
      const containers = rows.map(row => ({
        ...row,
        password: cryptoUtils.decrypt(row.password)
      }));

      resolve(containers);
    });
  });
}
```

## 🔒 Security Considerations

### Data Encryption
1. **At Rest**: Passwords encrypted in database
2. **In Memory**: Decrypted only when needed
3. **In Transit**: Database file should be secured

### Access Control
1. **File Permissions**: Restrict database file access
2. **Application Level**: Service layer controls access
3. **Environment**: Encryption keys in environment variables

### Backup Security
1. **Encrypted Backups**: Include encrypted data
2. **Key Management**: Secure encryption key storage
3. **Access Logging**: Track database access

## 📈 Monitoring & Maintenance

### Database Health Checks
```javascript
const checkDatabaseHealth = async () => {
  try {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM containers', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({ healthy: true, containerCount: row.count });
        }
      });
    });
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};
```

### Database Statistics
```sql
-- Container distribution by status
SELECT status, COUNT(*) as count
FROM containers
GROUP BY status;

-- Recent containers
SELECT name, ct_id, status, created_at
FROM containers
ORDER BY created_at DESC
LIMIT 10;

-- Containers by Jenkins job
SELECT jenkins_job_id, COUNT(*) as count
FROM containers
WHERE jenkins_job_id IS NOT NULL
GROUP BY jenkins_job_id;
```

### Maintenance Operations

#### Database Vacuum
```sql
VACUUM; -- Reclaim space and optimize
```

#### Analyze Statistics
```sql
ANALYZE; -- Update query planner statistics
```

#### Check Integrity
```sql
PRAGMA integrity_check;
```

## 🔄 Migration Strategy

### Schema Versioning
```javascript
const SCHEMA_VERSION = 1;

const checkSchemaVersion = async () => {
  // Check if schema_version table exists
  // Compare with current version
  // Run migrations if needed
};
```

### Migration Example
```javascript
const migrations = {
  1: {
    up: () => {
      // Create initial tables
    },
    down: () => {
      // Rollback changes
    }
  },
  2: {
    up: () => {
      // Add new columns
      db.run('ALTER TABLE containers ADD COLUMN description TEXT');
    },
    down: () => {
      // Remove columns (SQLite limitation workaround)
    }
  }
};
```

## 💾 Backup & Recovery

### Database Backup
```bash
# Simple file copy (application stopped)
cp /app/data/cardinal.db /backup/cardinal-$(date +%Y%m%d).db

# Live backup using SQLite
sqlite3 /app/data/cardinal.db ".backup /backup/cardinal-live-$(date +%Y%m%d).db"
```

### Database Recovery
```bash
# Restore from backup
cp /backup/cardinal-20250126.db /app/data/cardinal.db

# Verify integrity
sqlite3 /app/data/cardinal.db "PRAGMA integrity_check;"
```

### Data Export
```sql
-- Export containers to CSV
.headers on
.mode csv
.output containers_export.csv
SELECT * FROM containers;
```

## 🚀 Performance Optimization

### Query Optimization
1. **Use Indexes**: For frequently queried columns
2. **Limit Results**: Use LIMIT for large datasets
3. **Prepared Statements**: For repeated queries

### Connection Optimization
1. **Connection Reuse**: Single connection for SQLite
2. **WAL Mode**: Better concurrency
3. **Pragma Settings**: Optimize for use case

### Storage Optimization
1. **Regular Vacuum**: Reclaim deleted space
2. **Analyze**: Keep statistics current
3. **Monitor Size**: Track database growth

This database documentation provides the foundation for understanding data storage and management in Cardinal. The schema is designed for simplicity while maintaining security and performance.
