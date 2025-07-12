const Container = require('../models/Container');
const ProxmoxService = require('./ProxmoxService');
const cryptoUtils = require('../utils/crypto');
const logger = require('../utils/logger');

class ContainerService {
  constructor() {
    this.proxmox = new ProxmoxService();
  }

  async createContainer(requestData) {
    try {
      const {
        name,
        hostname,
        cores,
        memory,
        disk,
        ostemplate,
        jenkins_job_id,
        additionalConfig = {}
      } = requestData;

      // Générer un mot de passe sécurisé pour le conteneur
      const containerPassword = cryptoUtils.generatePassword();
      const containerUsername = process.env.CT_DEFAULT_USERNAME || 'root';

      logger.info(`Creating container: ${name} (${hostname})`);

      // Créer le conteneur sur Proxmox
      const proxmoxResult = await this.proxmox.createContainer({
        hostname,
        cores,
        memory,
        disk,
        ostemplate,
        password: containerPassword,
        additionalConfig
      });

      // Enregistrer le conteneur en base de données
      const containerRecord = await Container.create({
        ct_id: proxmoxResult.vmid.toString(),
        name,
        username: containerUsername,
        password: containerPassword,
        jenkins_job_id
      });

      logger.info(`Container ${name} created successfully with VMID: ${proxmoxResult.vmid}`);

      // Mettre à jour le statut à "running" et récupérer l'IP
      setTimeout(async () => {
        try {
          const ip = await this.proxmox.getContainerIP(proxmoxResult.vmid);
          await Container.updateStatus(
            proxmoxResult.vmid.toString(),
            'running',
            ip
          );
          logger.info(`Container ${proxmoxResult.vmid} IP updated: ${ip}`);
        } catch (error) {
          logger.error('Error updating container IP:', error.message);
        }
      }, 10000); // Attendre 10 secondes

      return {
        success: true,
        container: {
          id: containerRecord.id,
          ct_id: proxmoxResult.vmid,
          name,
          hostname,
          username: containerUsername,
          status: 'creating'
        },
        message: 'Container creation started successfully'
      };

    } catch (error) {
      logger.error('Container creation service error:', error.message);
      throw new Error(`Failed to create container: ${error.message}`);
    }
  }

  async getContainerAccess(ct_id) {
    try {
      const container = await Container.findByCtId(ct_id);

      if (!container) {
        throw new Error('Container not found');
      }

      if (container.status !== 'running') {
        throw new Error('Container is not running');
      }

      // Créer une sauvegarde avant de donner l'accès
      // TODO: Implémenter la création de sauvegarde

      return {
        success: true,
        access: {
          ct_id: container.ct_id,
          ip_address: container.ip_address,
          username: container.username,
          password: container.password
        },
        message: 'Container access granted'
      };

    } catch (error) {
      logger.error('Get container access error:', error.message);
      throw new Error(`Failed to get container access: ${error.message}`);
    }
  }

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
}

module.exports = ContainerService;
