const Joi = require('joi');

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

const getAccessSchema = Joi.object({
  ct_id: Joi.string().required()
    .description('ID du conteneur')
});

const webhookAuthSchema = Joi.object({
  secret: Joi.string().required()
    .description('Secret du webhook')
});

module.exports = {
  createContainerSchema,
  getAccessSchema,
  webhookAuthSchema
};
