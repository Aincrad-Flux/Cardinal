module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },

  proxmox: {
    host: process.env.PROXMOX_HOST,
    port: process.env.PROXMOX_PORT || 8006,
    username: process.env.PROXMOX_USERNAME,
    password: process.env.PROXMOX_PASSWORD,
    node: process.env.PROXMOX_NODE,
    defaults: {
      ostemplate: process.env.CT_DEFAULT_OSTEMPLATE || 'ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
      cores: parseInt(process.env.CT_DEFAULT_CORES) || 2,
      memory: parseInt(process.env.CT_DEFAULT_MEMORY) || 2048,
      disk: parseInt(process.env.CT_DEFAULT_DISK) || 8,
      username: process.env.CT_DEFAULT_USERNAME || 'root',
      password: process.env.CT_DEFAULT_PASSWORD
    }
  },

  security: {
    encryptionKey: process.env.ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET,
    webhookSecret: process.env.WEBHOOK_SECRET
  },

  database: {
    path: process.env.DB_PATH || './data/cardinal.db'
  }
};
