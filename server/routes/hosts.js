const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireAdmin, scopeToPC } = require('../middleware/auth');
const pandadocService = require('../services/pandadoc');

// GET /api/hosts
router.get('/', authenticate, async (req, res) => {
  try {
    const { campus_region, program, agreement_status, is_active } = req.query;
    let query = 'SELECT * FROM hosts WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (campus_region) {
      query += ` AND campus_region = $${paramIdx++}`;
      params.push(campus_region);
    }
    if (program) {
      query += ` AND $${paramIdx++} = ANY(programs_accepted)`;
      params.push(program);
    }
    if (agreement_status) {
      query += ` AND agreement_status = $${paramIdx++}`;
      params.push(agreement_status);
    }
    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIdx++}`;
      params.push(is_active === 'true');
    }

    query += ' ORDER BY org_name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get hosts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/hosts/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM hosts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }

    // Also get assigned students
    const students = await db.query(
      `SELECT s.id, s.first_name, s.last_name, s.email, s.status, s.hours_logged, s.hours_required,
              p.code as program_code
       FROM students s
       LEFT JOIN programs p ON s.program_id = p.id
       WHERE s.host_id = $1
       ORDER BY s.last_name`,
      [req.params.id]
    );

    res.json({ ...result.rows[0], students: students.rows });
  } catch (err) {
    console.error('Get host error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/hosts
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      org_name, contact_name, contact_email, contact_phone,
      address, campus_region, programs_accepted, capacity
    } = req.body;

    if (!org_name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const result = await db.query(
      `INSERT INTO hosts (org_name, contact_name, contact_email, contact_phone, address, campus_region, programs_accepted, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [org_name, contact_name, contact_email, contact_phone, address, campus_region, programs_accepted || [], capacity]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create host error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/hosts/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      org_name, contact_name, contact_email, contact_phone,
      address, campus_region, programs_accepted, capacity, is_active
    } = req.body;

    const result = await db.query(
      `UPDATE hosts SET
        org_name = COALESCE($1, org_name),
        contact_name = COALESCE($2, contact_name),
        contact_email = COALESCE($3, contact_email),
        contact_phone = COALESCE($4, contact_phone),
        address = COALESCE($5, address),
        campus_region = COALESCE($6, campus_region),
        programs_accepted = COALESCE($7, programs_accepted),
        capacity = COALESCE($8, capacity),
        is_active = COALESCE($9, is_active)
      WHERE id = $10
      RETURNING *`,
      [org_name, contact_name, contact_email, contact_phone, address, campus_region, programs_accepted, capacity, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update host error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/hosts/:id/send-agreement
router.post('/:id/send-agreement', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const host = await db.query('SELECT * FROM hosts WHERE id = $1', [id]);

    if (host.rows.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }

    const hostData = host.rows[0];
    const result = await pandadocService.sendAgreement(hostData);

    await db.query(
      `UPDATE hosts SET
        agreement_status = 'sent',
        agreement_sent_date = NOW(),
        pandadoc_document_id = $1
      WHERE id = $2`,
      [result.documentId, id]
    );

    // Log the email
    await db.query(
      `INSERT INTO email_log (trigger_type, recipient, host_id, metadata)
       VALUES ('agreement_sent', $1, $2, $3)`,
      [hostData.contact_email, id, JSON.stringify({ documentId: result.documentId })]
    );

    res.json({ message: 'Agreement sent', documentId: result.documentId });
  } catch (err) {
    console.error('Send agreement error:', err);
    res.status(500).json({ error: 'Failed to send agreement' });
  }
});

// GET /api/hosts/:id/agreement-status
router.get('/:id/agreement-status', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT agreement_status, agreement_doc_url, agreement_sent_date, agreement_executed_date, agreement_expires_date FROM hosts WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get agreement status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
