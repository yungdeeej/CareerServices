const cron = require('node-cron');
const db = require('../config/db');
const emailService = require('./emailService');
const { getRequiredDocs } = require('../utils/statusMachine');

const DOC_LABELS = {
  doc_first_aid: 'First Aid Certificate',
  doc_pic: 'PIC (Police Information Check)',
  doc_immunization: 'Immunization Records',
  doc_resume: 'Resume',
};

function init() {
  // Daily @ 8:00 AM — evaluate email triggers
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running daily email trigger evaluation...');
    await evaluateDocReminders();
    await evaluateReadyToLaunch();
    await evaluateCompletionTriggers();
  }, { timezone: 'America/Edmonton' });

  // Weekly @ Friday 3PM — send weekly pulse
  cron.schedule('0 15 * * 5', async () => {
    console.log('[CRON] Running weekly pulse emails...');
    await sendWeeklyPulse();
  }, { timezone: 'America/Edmonton' });

  // Monthly @ 1st @ 9AM — send host nurture
  cron.schedule('0 9 1 * *', async () => {
    console.log('[CRON] Running monthly host nurture emails...');
    await sendHostNurtureEmails();
  }, { timezone: 'America/Edmonton' });

  console.log('Cron jobs initialized.');
}

async function evaluateDocReminders() {
  try {
    const students = await db.query(`
      SELECT s.*, p.code as program_code
      FROM students s
      JOIN programs p ON s.program_id = p.id
      WHERE s.status = 'pre_req'
    `);

    for (const student of students.rows) {
      const requiredDocs = getRequiredDocs(student.program_code);
      const missingDocs = requiredDocs
        .filter(doc => !student[doc])
        .map(doc => DOC_LABELS[doc]);

      if (missingDocs.length > 0) {
        // Check if we already sent a reminder this month
        const lastSent = await db.query(
          `SELECT sent_at FROM email_log
           WHERE trigger_type = 'doc_reminder' AND student_id = $1
           ORDER BY sent_at DESC LIMIT 1`,
          [student.id]
        );

        const now = new Date();
        if (lastSent.rows.length === 0 ||
            new Date(lastSent.rows[0].sent_at).getMonth() !== now.getMonth()) {
          await emailService.sendEmail('doc_reminder', student.email, {
            studentName: `${student.first_name} ${student.last_name}`,
            missingDocs,
          }, student.id);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Doc reminder error:', err);
  }
}

async function evaluateReadyToLaunch() {
  try {
    const now = new Date();

    // T-60 check
    const t60Date = new Date(now);
    t60Date.setDate(t60Date.getDate() + 60);
    const t60DateStr = t60Date.toISOString().split('T')[0];

    const t60Students = await db.query(`
      SELECT s.*, u.email as pc_email, u.full_name as pc_name
      FROM students s
      LEFT JOIN users u ON s.assigned_pc_id = u.id
      WHERE s.practicum_start_date = $1
        AND s.status IN ('pre_req', 'ready')
    `, [t60DateStr]);

    for (const student of t60Students.rows) {
      const alreadySent = await db.query(
        `SELECT id FROM email_log WHERE trigger_type = 'ready_to_launch_60' AND student_id = $1`,
        [student.id]
      );
      if (alreadySent.rows.length === 0) {
        await emailService.sendEmail('ready_to_launch_60', student.email, {
          studentName: `${student.first_name} ${student.last_name}`,
        }, student.id);
      }
    }

    // T-30 check
    const t30Date = new Date(now);
    t30Date.setDate(t30Date.getDate() + 30);
    const t30DateStr = t30Date.toISOString().split('T')[0];

    const t30Students = await db.query(`
      SELECT s.*, u.email as pc_email
      FROM students s
      LEFT JOIN users u ON s.assigned_pc_id = u.id
      WHERE s.practicum_start_date = $1
        AND s.launch_meeting_booked = false
    `, [t30DateStr]);

    for (const student of t30Students.rows) {
      const alreadySent = await db.query(
        `SELECT id FROM email_log WHERE trigger_type = 'ready_to_launch_30' AND student_id = $1`,
        [student.id]
      );
      if (alreadySent.rows.length === 0) {
        await emailService.sendEmail('ready_to_launch_30', student.email, {
          studentName: `${student.first_name} ${student.last_name}`,
        }, student.id);
      }
    }
  } catch (err) {
    console.error('[CRON] Ready to launch error:', err);
  }
}

async function evaluateCompletionTriggers() {
  try {
    // Find students who just hit hours >= required and haven't got congrats email
    const completingStudents = await db.query(`
      SELECT s.* FROM students s
      WHERE s.status IN ('completing', 'complete')
        AND s.id NOT IN (
          SELECT student_id FROM email_log WHERE trigger_type = 'completion_congrats' AND student_id IS NOT NULL
        )
    `);

    for (const student of completingStudents.rows) {
      // Send completion congrats
      await emailService.sendEmail('completion_congrats', student.email, {
        studentName: `${student.first_name} ${student.last_name}`,
        hoursRequired: student.hours_required,
      }, student.id);

      // Schedule grading pack (10 min delay simulated by sending now in cron context)
      setTimeout(async () => {
        await emailService.sendEmail('grading_pack', student.email, {
          studentName: `${student.first_name} ${student.last_name}`,
        }, student.id);

        // Then exit survey
        await emailService.sendEmail('exit_survey', student.email, {
          studentName: `${student.first_name} ${student.last_name}`,
        }, student.id);
      }, 10 * 60 * 1000); // 10 minutes
    }
  } catch (err) {
    console.error('[CRON] Completion trigger error:', err);
  }
}

async function sendWeeklyPulse() {
  try {
    const activeStudents = await db.query(`
      SELECT * FROM students WHERE status = 'active'
    `);

    for (const student of activeStudents.rows) {
      await emailService.sendEmail('weekly_pulse', student.email, {
        studentName: `${student.first_name} ${student.last_name}`,
        hoursLogged: parseFloat(student.hours_logged),
        hoursRequired: student.hours_required,
      }, student.id);
    }
  } catch (err) {
    console.error('[CRON] Weekly pulse error:', err);
  }
}

async function sendHostNurtureEmails() {
  try {
    const hosts = await db.query(`
      SELECT * FROM hosts WHERE is_active = true AND contact_email IS NOT NULL
    `);

    for (const host of hosts.rows) {
      await emailService.sendEmail('host_nurture', host.contact_email, {
        contactName: host.contact_name || 'Partner',
      }, null, host.id);

      await db.query(
        'UPDATE hosts SET last_nurture_email_sent = NOW() WHERE id = $1',
        [host.id]
      );
    }
  } catch (err) {
    console.error('[CRON] Host nurture error:', err);
  }
}

module.exports = { init };
