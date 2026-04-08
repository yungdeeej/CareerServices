const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Scope PC access to their assigned students only
const scopeToPC = (req, res, next) => {
  // Admins bypass scoping
  if (req.user.role === 'admin') {
    req.pcScope = null; // no filter
  } else {
    req.pcScope = req.user.id; // filter by assigned_pc_id
  }
  next();
};

module.exports = { authenticate, requireAdmin, scopeToPC };
