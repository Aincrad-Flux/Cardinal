const logger = require('../utils/logger');

const webhookAuth = (req, res, next) => {
  const providedSecret = req.headers['x-webhook-secret'] || req.body.secret;
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('WEBHOOK_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Webhook authentication not configured'
    });
  }

  if (!providedSecret) {
    logger.warn('Webhook request without secret', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      error: 'Webhook secret required'
    });
  }

  if (providedSecret !== expectedSecret) {
    logger.warn('Invalid webhook secret', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid webhook secret'
    });
  }

  // Log de la requête authentifiée
  logger.info('Webhook request authenticated', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  next();
};

module.exports = {
  webhookAuth
};
