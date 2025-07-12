const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');

class ProxmoxService {
  constructor() {
    this.host = process.env.PROXMOX_HOST;
    this.port = process.env.PROXMOX_PORT || 8006;
    this.username = process.env.PROXMOX_USERNAME;
    this.password = process.env.PROXMOX_PASSWORD;
    this.node = process.env.PROXMOX_NODE;
    this.baseURL = `https://${this.host}:${this.port}/api2/json`;
    this.ticket = null;
    this.csrfToken = null;

    // Ignorer les certificats SSL auto-signés (pour le développement)
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 30000
    });
  }

  async authenticate() {
    try {
      const response = await this.axiosInstance.post(`${this.baseURL}/access/ticket`, {
        username: this.username,
        password: this.password
      });

      if (response.data && response.data.data) {
        this.ticket = response.data.data.ticket;
        this.csrfToken = response.data.data.CSRFPreventionToken;

        // Configurer les headers par défaut
        this.axiosInstance.defaults.headers.common['Cookie'] = `PVEAuthCookie=${this.ticket}`;
        this.axiosInstance.defaults.headers.common['CSRFPreventionToken'] = this.csrfToken;

        logger.info('Successfully authenticated with Proxmox');
        return true;
      }

      throw new Error('Invalid authentication response');
    } catch (error) {
      logger.error('Proxmox authentication failed:', error.message);
      throw new Error(`Proxmox authentication failed: ${error.message}`);
    }
  }

  async createContainer(config) {
    try {
      // S'assurer d'être authentifié
      if (!this.ticket) {
        await this.authenticate();
      }

      const containerConfig = {
        vmid: config.vmid || await this.getNextVMID(),
        ostemplate: config.ostemplate || process.env.CT_DEFAULT_OSTEMPLATE,
        hostname: config.hostname,
        cores: config.cores || process.env.CT_DEFAULT_CORES || 2,
        memory: config.memory || process.env.CT_DEFAULT_MEMORY || 2048,
        swap: config.swap || 512,
        net0: config.network || 'name=eth0,bridge=vmbr0,ip=dhcp',
        rootfs: `local-lvm:${config.disk || process.env.CT_DEFAULT_DISK || 8}`,
        password: config.password || process.env.CT_DEFAULT_PASSWORD,
        unprivileged: 1,
        start: 1,
        ...config.additionalConfig
      };

      logger.info('Creating container with config:', {
        vmid: containerConfig.vmid,
        hostname: containerConfig.hostname
      });

      const response = await this.axiosInstance.post(
        `${this.baseURL}/nodes/${this.node}/lxc`,
        containerConfig
      );

      if (response.data && response.data.data) {
        const taskId = response.data.data;
        logger.info(`Container creation task started: ${taskId}`);

        // Attendre que la tâche soit terminée
        await this.waitForTask(taskId);

        // Attendre que le conteneur démarre
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

  async getNextVMID() {
    try {
      const response = await this.axiosInstance.get(`${this.baseURL}/cluster/nextid`);

      if (response.data && response.data.data) {
        return parseInt(response.data.data);
      }

      // Fallback: générer un ID aléatoire entre 1000-9999
      return Math.floor(Math.random() * 9000) + 1000;
    } catch (error) {
      logger.warn('Could not get next VMID, using random:', error.message);
      return Math.floor(Math.random() * 9000) + 1000;
    }
  }

  async waitForTask(taskId, maxWaitTime = 300000) { // 5 minutes max
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

        // Attendre 2 secondes avant de vérifier à nouveau
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

  async waitForContainerStart(vmid, maxWaitTime = 120000) { // 2 minutes max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getContainerStatus(vmid);

        if (status === 'running') {
          logger.info(`Container ${vmid} is running`);
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        logger.warn('Error checking container status:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Container start timeout');
  }

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

  async getContainerIP(vmid) {
    try {
      // Attendre un peu pour que l'IP soit assignée
      await new Promise(resolve => setTimeout(resolve, 5000));

      const response = await this.axiosInstance.get(
        `${this.baseURL}/nodes/${this.node}/lxc/${vmid}/config`
      );

      if (response.data && response.data.data) {
        const config = response.data.data;

        // Essayer de récupérer l'IP depuis la configuration réseau
        if (config.net0) {
          const netConfig = config.net0;
          const ipMatch = netConfig.match(/ip=([^,]+)/);
          if (ipMatch && ipMatch[1] !== 'dhcp') {
            return ipMatch[1].split('/')[0]; // Retirer le masque de sous-réseau
          }
        }
      }

      // Si DHCP, essayer de récupérer l'IP via l'agent
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
}

module.exports = ProxmoxService;
