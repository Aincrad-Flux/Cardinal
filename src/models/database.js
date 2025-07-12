const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Créer le répertoire data s'il n'existe pas
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'cardinal.db');

let db;

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logger.error('Error opening database:', err);
        reject(err);
        return;
      }

      logger.info('Connected to SQLite database');

      // Créer les tables
      createTables()
        .then(resolve)
        .catch(reject);
    });
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    const createContainersTable = `
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
    `;

    const createBackupsTable = `
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_id INTEGER,
        backup_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (container_id) REFERENCES containers (id)
      )
    `;

    db.serialize(() => {
      db.run(createContainersTable, (err) => {
        if (err) {
          logger.error('Error creating containers table:', err);
          reject(err);
          return;
        }
      });

      db.run(createBackupsTable, (err) => {
        if (err) {
          logger.error('Error creating backups table:', err);
          reject(err);
          return;
        }

        logger.info('Database tables created successfully');
        resolve();
      });
    });
  });
};

const getDatabase = () => db;

module.exports = {
  initDatabase,
  getDatabase
};
