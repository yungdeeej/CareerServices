const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY full_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email.toLowerCase().trim(), passwordHash, full_name, role || 'pc']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, is_active, password } = req.body;

    let query, params;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query = `UPDATE users SET email = $1, full_name = $2, role = $3, is_active = $4, password_hash = $5
               WHERE id = $6
               RETURNING id, email, full_name, role, is_active, created_at`;
      params = [email.toLowerCase().trim(), full_name, role, is_active, passwordHash, id];
    } else {
      query = `UPDATE users SET email = $1, full_name = $2, role = $3, is_active = $4
               WHERE id = $5
               RETURNING id, email, full_name, role, is_active, created_at`;
      params = [email.toLowerCase().trim(), full_name, role, is_active, id];
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id (soft delete — deactivate)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
