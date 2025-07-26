const express = require('express');
const { webhookAuth } = require('../middleware/auth');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

// Health check (sans authentification)
router.get('/health', webhookController.healthCheck.bind(webhookController));

// Routes protégées par authentification webhook
router.use(webhookAuth);

// Créer un nouveau conteneur
router.post('/create-container', webhookController.createContainer.bind(webhookController));

// Obtenir l'accès à un conteneur
router.post('/get-access', webhookController.getContainerAccess.bind(webhookController));

// Lister tous les conteneurs
router.get('/containers', webhookController.listContainers.bind(webhookController));

module.exports = router;
