const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/programs
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM programs ORDER BY code');
    res.json(result.rows);
  } catch (err) {
    console.error('Get programs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
