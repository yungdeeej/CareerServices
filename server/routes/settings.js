const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getTemplates } = require('../services/emailService');

// GET /api/settings/email-templates
router.get('/email-templates', authenticate, requireAdmin, (req, res) => {
  res.json(getTemplates());
});

// GET /api/settings/integration-mode
router.get('/integration-mode', authenticate, requireAdmin, (req, res) => {
  res.json({ mode: process.env.INTEGRATION_MODE || 'mock' });
});

// GET /api/settings/config
router.get('/config', authenticate, requireAdmin, (req, res) => {
  res.json({
    integrationMode: process.env.INTEGRATION_MODE || 'mock',
    sendgridConfigured: !!process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'mock-sendgrid-key',
    pandadocConfigured: !!process.env.PANDADOC_API_KEY && process.env.PANDADOC_API_KEY !== 'mock-pandadoc-key',
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || '',
  });
});

module.exports = router;
