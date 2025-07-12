require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const webhookRoutes = require('./routes/webhook');
const { initDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/webhook', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

    app.listen(PORT, () => {
      logger.info(`Cardinal server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
