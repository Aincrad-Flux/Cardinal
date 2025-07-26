const crypto = require('crypto');

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

module.exports = new CryptoUtils();
