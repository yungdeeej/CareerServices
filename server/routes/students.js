const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../config/db');
const { authenticate, requireAdmin, scopeToPC } = require('../middleware/auth');
const { evaluateStatus, getRequiredDocs } = require('../utils/statusMachine');

const upload = multer({ storage: multer.memoryStorage() });

// Helper: update student status based on current data
async function refreshStudentStatus(studentId) {
  const res = await db.query(
    `SELECT s.*, p.code as program_code FROM students s
     JOIN programs p ON s.program_id = p.id
     WHERE s.id = $1`,
    [studentId]
  );
  if (res.rows.length === 0) return null;

  const student = res.rows[0];
  const newStatus = evaluateStatus(student, student.program_code);

  if (newStatus !== student.status) {
    await db.query(
      'UPDATE students SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, studentId]
    );
    return newStatus;
  }
  return student.status;
}

// GET /api/students
router.get('/', authenticate, scopeToPC, async (req, res) => {
  try {
    const { status, program_id, campus, assigned_pc_id, start_date, end_date } = req.query;
    let query = `
      SELECT s.*, p.code as program_code, p.name as program_name,
             u.full_name as pc_name, h.org_name as host_name
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN users u ON s.assigned_pc_id = u.id
      LEFT JOIN hosts h ON s.host_id = h.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    // PC scoping
    if (req.pcScope) {
      query += ` AND s.assigned_pc_id = $${paramIdx++}`;
      params.push(req.pcScope);
    }

    if (status) {
      query += ` AND s.status = $${paramIdx++}`;
      params.push(status);
    }
    if (program_id) {
      query += ` AND s.program_id = $${paramIdx++}`;
      params.push(program_id);
    }
    if (campus) {
      query += ` AND s.campus = $${paramIdx++}`;
      params.push(campus);
    }
    if (assigned_pc_id) {
      query += ` AND s.assigned_pc_id = $${paramIdx++}`;
      params.push(assigned_pc_id);
    }
    if (start_date) {
      query += ` AND s.practicum_start_date >= $${paramIdx++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND s.practicum_start_date <= $${paramIdx++}`;
      params.push(end_date);
    }

    query += ' ORDER BY s.last_name, s.first_name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/:id
router.get('/:id', authenticate, scopeToPC, async (req, res) => {
  try {
    let query = `
      SELECT s.*, p.code as program_code, p.name as program_name,
             u.full_name as pc_name, h.org_name as host_name
      FROM students s
      LEFT JOIN programs p ON s.program_id = p.id
      LEFT JOIN users u ON s.assigned_pc_id = u.id
      LEFT JOIN hosts h ON s.host_id = h.id
      WHERE s.id = $1
    `;
    const params = [req.params.id];

    if (req.pcScope) {
      query += ' AND s.assigned_pc_id = $2';
      params.push(req.pcScope);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/students
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      campus_login_id, first_name, last_name, email, phone,
      program_id, campus, cohort_start_date, practicum_start_date, practicum_end_date,
      assigned_pc_id, host_id, hours_required,
      doc_first_aid, doc_pic, doc_immunization, doc_resume
    } = req.body;

    if (!first_name || !last_name || !email || !hours_required) {
      return res.status(400).json({ error: 'First name, last name, email, and hours required are required' });
    }

    // Enforce host agreement check
    if (host_id) {
      const hostCheck = await db.query('SELECT agreement_status FROM hosts WHERE id = $1', [host_id]);
      if (hostCheck.rows.length > 0 && hostCheck.rows[0].agreement_status !== 'executed') {
        return res.status(400).json({ error: 'Cannot assign student to host without executed agreement' });
      }
    }

    const result = await db.query(
      `INSERT INTO students (
        campus_login_id, first_name, last_name, email, phone,
        program_id, campus, cohort_start_date, practicum_start_date, practicum_end_date,
        assigned_pc_id, host_id, hours_required,
        doc_first_aid, doc_pic, doc_immunization, doc_resume
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        campus_login_id, first_name, last_name, email.toLowerCase().trim(), phone,
        program_id, campus, cohort_start_date || null, practicum_start_date || null, practicum_end_date || null,
        assigned_pc_id || null, host_id || null, hours_required,
        doc_first_aid || false, doc_pic || false, doc_immunization || false, doc_resume || false
      ]
    );

    // Evaluate initial status
    await refreshStudentStatus(result.rows[0].id);
    const updated = await db.query('SELECT * FROM students WHERE id = $1', [result.rows[0].id]);

    res.status(201).json(updated.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Student with this email or campus login ID already exists' });
    }
    console.error('Create student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/students/:id
router.put('/:id', authenticate, scopeToPC, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify PC can access this student
    if (req.pcScope) {
      const check = await db.query('SELECT id FROM students WHERE id = $1 AND assigned_pc_id = $2', [id, req.pcScope]);
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const {
      campus_login_id, first_name, last_name, email, phone,
      program_id, campus, cohort_start_date, practicum_start_date, practicum_end_date,
      assigned_pc_id, host_id, hours_required, status,
      grading_pack_sent, timesheet_uploaded, final_eval_uploaded,
      exit_survey_submitted, grade_released,
      launch_meeting_booked, launch_meeting_date,
      doc_first_aid, doc_pic, doc_immunization, doc_resume
    } = req.body;

    // Enforce host agreement check
    if (host_id) {
      const hostCheck = await db.query('SELECT agreement_status FROM hosts WHERE id = $1', [host_id]);
      if (hostCheck.rows.length > 0 && hostCheck.rows[0].agreement_status !== 'executed') {
        return res.status(400).json({ error: 'Cannot assign student to host without executed agreement' });
      }
    }

    const result = await db.query(
      `UPDATE students SET
        campus_login_id = COALESCE($1, campus_login_id),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        program_id = COALESCE($6, program_id),
        campus = COALESCE($7, campus),
        cohort_start_date = COALESCE($8, cohort_start_date),
        practicum_start_date = COALESCE($9, practicum_start_date),
        practicum_end_date = COALESCE($10, practicum_end_date),
        assigned_pc_id = COALESCE($11, assigned_pc_id),
        host_id = $12,
        hours_required = COALESCE($13, hours_required),
        grading_pack_sent = COALESCE($14, grading_pack_sent),
        timesheet_uploaded = COALESCE($15, timesheet_uploaded),
        final_eval_uploaded = COALESCE($16, final_eval_uploaded),
        exit_survey_submitted = COALESCE($17, exit_survey_submitted),
        grade_released = COALESCE($18, grade_released),
        launch_meeting_booked = COALESCE($19, launch_meeting_booked),
        launch_meeting_date = $20,
        doc_first_aid = COALESCE($21, doc_first_aid),
        doc_pic = COALESCE($22, doc_pic),
        doc_immunization = COALESCE($23, doc_immunization),
        doc_resume = COALESCE($24, doc_resume),
        updated_at = NOW()
      WHERE id = $25
      RETURNING *`,
      [
        campus_login_id, first_name, last_name, email ? email.toLowerCase().trim() : null, phone,
        program_id, campus, cohort_start_date, practicum_start_date, practicum_end_date,
        assigned_pc_id, host_id !== undefined ? host_id : null, hours_required,
        grading_pack_sent, timesheet_uploaded, final_eval_uploaded,
        exit_survey_submitted, grade_released,
        launch_meeting_booked, launch_meeting_date || null,
        doc_first_aid, doc_pic, doc_immunization, doc_resume,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // If status is manually overridden by admin, use that; otherwise auto-evaluate
    if (status && req.user.role === 'admin') {
      await db.query('UPDATE students SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    } else {
      await refreshStudentStatus(id);
    }

    const updated = await db.query(
      `SELECT s.*, p.code as program_code, p.name as program_name,
              u.full_name as pc_name, h.org_name as host_name
       FROM students s
       LEFT JOIN programs p ON s.program_id = p.id
       LEFT JOIN users u ON s.assigned_pc_id = u.id
       LEFT JOIN hosts h ON s.host_id = h.id
       WHERE s.id = $1`,
      [id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Duplicate email or campus login ID' });
    }
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/students/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted' });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/students/:id/docs
router.patch('/:id/docs', authenticate, scopeToPC, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.pcScope) {
      const check = await db.query('SELECT id FROM students WHERE id = $1 AND assigned_pc_id = $2', [id, req.pcScope]);
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { doc_first_aid, doc_pic, doc_immunization, doc_resume } = req.body;

    await db.query(
      `UPDATE students SET
        doc_first_aid = COALESCE($1, doc_first_aid),
        doc_pic = COALESCE($2, doc_pic),
        doc_immunization = COALESCE($3, doc_immunization),
        doc_resume = COALESCE($4, doc_resume),
        updated_at = NOW()
      WHERE id = $5`,
      [doc_first_aid, doc_pic, doc_immunization, doc_resume, id]
    );

    // Re-evaluate status after doc update
    await refreshStudentStatus(id);

    const result = await db.query(
      `SELECT s.*, p.code as program_code FROM students s
       LEFT JOIN programs p ON s.program_id = p.id
       WHERE s.id = $1`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update docs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/students/:id/hours
router.get('/:id/hours', authenticate, scopeToPC, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.pcScope) {
      const check = await db.query('SELECT id FROM students WHERE id = $1 AND assigned_pc_id = $2', [id, req.pcScope]);
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await db.query(
      `SELECT hl.*, u.full_name as approved_by_name
       FROM hours_log hl
       LEFT JOIN users u ON hl.approved_by = u.id
       WHERE hl.student_id = $1
       ORDER BY hl.week_ending_date DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get hours error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/students/:id/hours
router.post('/:id/hours', authenticate, scopeToPC, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.pcScope) {
      const check = await db.query('SELECT id FROM students WHERE id = $1 AND assigned_pc_id = $2', [id, req.pcScope]);
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { week_ending_date, hours_submitted, supervisor_name, notes } = req.body;

    if (!week_ending_date || !hours_submitted) {
      return res.status(400).json({ error: 'Week ending date and hours are required' });
    }

    const entry = await db.query(
      `INSERT INTO hours_log (student_id, week_ending_date, hours_submitted, supervisor_name, notes, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [id, week_ending_date, hours_submitted, supervisor_name, notes, req.user.id]
    );

    // Update total hours on student
    await db.query(
      `UPDATE students SET hours_logged = (
        SELECT COALESCE(SUM(hours_submitted), 0) FROM hours_log WHERE student_id = $1
      ), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Re-evaluate status
    await refreshStudentStatus(id);

    res.status(201).json(entry.rows[0]);
  } catch (err) {
    console.error('Log hours error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/students/import-csv
router.post('/import-csv', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = { success: [], errors: [] };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-indexed + header row

      try {
        // Validate required fields
        if (!row.first_name || !row.last_name || !row.email || !row.program_code || !row.hours_required) {
          results.errors.push({ row: rowNum, error: 'Missing required fields (first_name, last_name, email, program_code, hours_required)' });
          continue;
        }

        // Validate program code
        const progResult = await db.query('SELECT id FROM programs WHERE code = $1', [row.program_code.toUpperCase()]);
        if (progResult.rows.length === 0) {
          results.errors.push({ row: rowNum, error: `Invalid program code: ${row.program_code}` });
          continue;
        }

        // Resolve PC by email
        let pcId = null;
        if (row.assigned_pc_email) {
          const pcResult = await db.query('SELECT id FROM users WHERE email = $1', [row.assigned_pc_email.toLowerCase().trim()]);
          if (pcResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `PC not found: ${row.assigned_pc_email}` });
            continue;
          }
          pcId = pcResult.rows[0].id;
        }

        const yesNo = (val) => val && val.toUpperCase() === 'Y';

        const insertResult = await db.query(
          `INSERT INTO students (
            campus_login_id, first_name, last_name, email, phone,
            program_id, campus, cohort_start_date, practicum_start_date,
            assigned_pc_id, host_id, hours_required,
            doc_first_aid, doc_pic, doc_immunization, doc_resume,
            imported_via_csv
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)
          RETURNING id`,
          [
            row.campus_login_id || null,
            row.first_name,
            row.last_name,
            row.email.toLowerCase().trim(),
            row.phone || null,
            progResult.rows[0].id,
            row.campus || null,
            row.cohort_start_date || null,
            row.practicum_start_date || null,
            pcId,
            row.host_id || null,
            parseInt(row.hours_required),
            yesNo(row.doc_first_aid),
            yesNo(row.doc_pic),
            yesNo(row.doc_immunization),
            yesNo(row.doc_resume),
          ]
        );

        await refreshStudentStatus(insertResult.rows[0].id);
        results.success.push({ row: rowNum, studentId: insertResult.rows[0].id, name: `${row.first_name} ${row.last_name}` });
      } catch (err) {
        if (err.code === '23505') {
          results.errors.push({ row: rowNum, error: 'Duplicate email or campus login ID' });
        } else {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }
    }

    res.json({
      total: records.length,
      imported: results.success.length,
      failed: results.errors.length,
      success: results.success,
      errors: results.errors,
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Failed to parse CSV file' });
  }
});

module.exports = router;
