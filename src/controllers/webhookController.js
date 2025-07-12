const ContainerService = require('../services/ContainerService');
const { createContainerSchema, getAccessSchema } = require('../middleware/validation');
const logger = require('../utils/logger');

class WebhookController {
  constructor() {
    this.containerService = new ContainerService();
  }

  async createContainer(req, res, next) {
    try {
      // Validation des données
      const { error, value } = createContainerSchema.validate(req.body);
      if (error) {
        error.isJoi = true;
        return next(error);
      }

      logger.info('Webhook: Create container request', {
        name: value.name,
        hostname: value.hostname,
        jenkins_job_id: value.jenkins_job_id
      });

      // Créer le conteneur
      const result = await this.containerService.createContainer(value);

      res.status(201).json(result);

    } catch (error) {
      next(error);
    }
  }

  async getContainerAccess(req, res, next) {
    try {
      // Validation des données
      const { error, value } = getAccessSchema.validate(req.body);
      if (error) {
        error.isJoi = true;
        return next(error);
      }

      logger.info('Webhook: Get container access request', {
        ct_id: value.ct_id
      });

      // Récupérer l'accès au conteneur
      const result = await this.containerService.getContainerAccess(value.ct_id);

      res.json(result);

    } catch (error) {
      next(error);
    }
  }

  async listContainers(req, res, next) {
    try {
      logger.info('Webhook: List containers request');

      const result = await this.containerService.listContainers();

      res.json(result);

    } catch (error) {
      next(error);
    }
  }

  async healthCheck(req, res) {
    res.json({
      success: true,
      message: 'Cardinal webhook service is running',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new WebhookController();
