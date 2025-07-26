const { getDatabase } = require('./database');
const cryptoUtils = require('../utils/crypto');
const logger = require('../utils/logger');

class Container {
  static async create(containerData) {
    const db = getDatabase();
    const { ct_id, name, username, password, jenkins_job_id } = containerData;

    // Chiffrer le mot de passe
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

        logger.info(`Container record created with ID: ${this.lastID}`);
        resolve({
          id: this.lastID,
          ct_id,
          name,
          username,
          jenkins_job_id
        });
      });
    });
  }

  static async findById(id) {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM containers WHERE id = ?';

      db.get(query, [id], (err, row) => {
        if (err) {
          logger.error('Error finding container:', err);
          reject(err);
          return;
        }

        if (row) {
          // Déchiffrer le mot de passe
          row.password = cryptoUtils.decrypt(row.password);
        }

        resolve(row);
      });
    });
  }

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
          // Déchiffrer le mot de passe
          row.password = cryptoUtils.decrypt(row.password);
        }

        resolve(row);
      });
    });
  }

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

        // Déchiffrer les mots de passe
        const containers = rows.map(row => ({
          ...row,
          password: cryptoUtils.decrypt(row.password)
        }));

        resolve(containers);
      });
    });
  }
}

module.exports = Container;
