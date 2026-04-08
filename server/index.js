require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cronJobs = require('./services/cronJobs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Integration mode banner endpoint
app.get('/api/integration-mode', (req, res) => {
  res.json({ mode: process.env.INTEGRATION_MODE || 'mock' });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/hosts', require('./routes/hosts'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/settings', require('./routes/settings'));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Start cron jobs
cronJobs.init();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Integration mode: ${process.env.INTEGRATION_MODE || 'mock'}`);
});

module.exports = app;
