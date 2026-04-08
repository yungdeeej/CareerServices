const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/reports/summary
router.get('/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const [totalActive, byStatus, hostsNoAgreement, completionRate] = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM students WHERE status IN ('active', 'completing')`),
      db.query(`
        SELECT status, COUNT(*) as count
        FROM students
        GROUP BY status
        ORDER BY status
      `),
      db.query(`SELECT COUNT(*) as count FROM hosts WHERE agreement_status != 'executed' AND is_active = true`),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'complete') as completed,
          COUNT(*) as total
        FROM students
        WHERE created_at >= NOW() - INTERVAL '90 days'
      `),
    ]);

    const completionData = completionRate.rows[0];
    const rate = completionData.total > 0
      ? ((completionData.completed / completionData.total) * 100).toFixed(1)
      : 0;

    res.json({
      totalActive: parseInt(totalActive.rows[0].count),
      byStatus: byStatus.rows,
      hostsWithoutAgreement: parseInt(hostsNoAgreement.rows[0].count),
      completionRate90Days: parseFloat(rate),
    });
  } catch (err) {
    console.error('Report summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/completion-rates
router.get('/completion-rates', authenticate, requireAdmin, async (req, res) => {
  try {
    const [byProgram, byPC, avgDays] = await Promise.all([
      db.query(`
        SELECT p.code, p.name,
          COUNT(*) FILTER (WHERE s.status = 'complete') as completed,
          COUNT(*) as total,
          CASE WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE s.status = 'complete')::numeric / COUNT(*)) * 100, 1)
            ELSE 0
          END as rate
        FROM students s
        JOIN programs p ON s.program_id = p.id
        GROUP BY p.code, p.name
        ORDER BY p.code
      `),
      db.query(`
        SELECT u.full_name as pc_name,
          COUNT(*) FILTER (WHERE s.status = 'complete') as completed,
          COUNT(*) as total,
          CASE WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE s.status = 'complete')::numeric / COUNT(*)) * 100, 1)
            ELSE 0
          END as rate
        FROM students s
        JOIN users u ON s.assigned_pc_id = u.id
        GROUP BY u.full_name
        ORDER BY u.full_name
      `),
      db.query(`
        SELECT
          p.code,
          ROUND(AVG(EXTRACT(EPOCH FROM (s.practicum_start_date - s.cohort_start_date)) / 86400)) as avg_days_to_start,
          ROUND(AVG(
            CASE WHEN s.status = 'complete' THEN
              EXTRACT(EPOCH FROM (s.updated_at - s.practicum_start_date)) / 86400
            END
          )) as avg_days_to_complete
        FROM students s
        JOIN programs p ON s.program_id = p.id
        WHERE s.cohort_start_date IS NOT NULL
        GROUP BY p.code
        ORDER BY p.code
      `),
    ]);

    res.json({
      byProgram: byProgram.rows,
      byPC: byPC.rows,
      averageDays: avgDays.rows,
    });
  } catch (err) {
    console.error('Completion rates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/doc-bottlenecks
router.get('/doc-bottlenecks', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.code as program_code,
        COUNT(*) FILTER (WHERE NOT s.doc_first_aid AND p.code IN ('BMT','AMT','MOA')) as missing_first_aid,
        COUNT(*) FILTER (WHERE NOT s.doc_pic AND p.code IN ('BMT','AMT','MOA')) as missing_pic,
        COUNT(*) FILTER (WHERE NOT s.doc_immunization AND p.code IN ('BMT','AMT','MOA')) as missing_immunization,
        COUNT(*) FILTER (WHERE NOT s.doc_resume) as missing_resume,
        COUNT(*) as total_students
      FROM students s
      JOIN programs p ON s.program_id = p.id
      WHERE s.status = 'pre_req'
      GROUP BY p.code
      ORDER BY p.code
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Doc bottlenecks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
