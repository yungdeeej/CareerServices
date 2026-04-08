// Email service — SendGrid integration with mock mode support
const db = require('../config/db');

const isMock = () => process.env.INTEGRATION_MODE !== 'live';

const EMAIL_TEMPLATES = {
  doc_reminder: {
    subject: 'Reminder: Outstanding Documents for Your Practicum',
    body: (data) => `Hi ${data.studentName},\n\nThis is a reminder that the following documents are still outstanding for your practicum:\n\n${data.missingDocs.map(d => `- ${d}`).join('\n')}\n\nPlease submit these as soon as possible.\n\nBest regards,\nMCG Career Services`,
  },
  ready_to_launch_60: {
    subject: 'Action Required: Practicum Launch Meeting — 60 Days',
    body: (data) => `Hi ${data.studentName},\n\nYour practicum start date is 60 days away. Please book your mandatory 15-minute launch meeting.\n\nBook here: ${data.bookingLink || '[Booking link to be configured]'}\n\nBest regards,\nMCG Career Services`,
  },
  ready_to_launch_30: {
    subject: 'Urgent: Book Your Practicum Launch Meeting — 30 Days',
    body: (data) => `Hi ${data.studentName},\n\nYour practicum starts in 30 days and your launch meeting has not been booked yet. This is mandatory.\n\nBook now: ${data.bookingLink || '[Booking link to be configured]'}\n\nBest regards,\nMCG Career Services`,
  },
  weekly_pulse: {
    subject: 'Weekly Check-In: How\'s Your Practicum Going?',
    body: (data) => `Hi ${data.studentName},\n\nHope your practicum is going well! Please submit your hours for this week.\n\nHours logged so far: ${data.hoursLogged} / ${data.hoursRequired}\n\nBest regards,\nMCG Career Services`,
  },
  completion_congrats: {
    subject: 'Congratulations! You\'ve Completed Your Practicum Hours!',
    body: (data) => `Hi ${data.studentName},\n\nCongratulations! You have successfully completed all ${data.hoursRequired} required practicum hours!\n\nNext steps will follow shortly.\n\nBest regards,\nMCG Career Services`,
  },
  grading_pack: {
    subject: 'Action Required: Submit Your Grading Pack',
    body: (data) => `Hi ${data.studentName},\n\nPlease upload the following documents to complete your practicum file:\n\n1. Signed Timesheet\n2. Final Evaluation\n\nNote: Your grade will not be released until all documents are submitted and your exit survey is completed.\n\nBest regards,\nMCG Career Services`,
  },
  exit_survey: {
    subject: 'Final Step: Complete Your Grad Exit Survey',
    body: (data) => `Hi ${data.studentName},\n\nPlease complete your Grad Exit Survey to finalize your practicum.\n\nSurvey link: ${data.surveyLink || '[Survey link to be configured]'}\n\nReminder: Your grade will not be released until this survey is submitted.\n\nBest regards,\nMCG Career Services`,
  },
  host_nurture: {
    subject: 'MCG Career College — Monthly Partner Check-In',
    body: (data) => `Hi ${data.contactName},\n\nThank you for your continued partnership with MCG Career College!\n\nTwo quick items:\n1. Are you available to host a practicum student in the coming months? Reply to confirm.\n2. Do you have any job openings suitable for MCG alumni? We'd love to share them with our graduates.\n\nBest regards,\nMCG Career Services`,
  },
  agreement_sent: {
    subject: 'MCG Career College — Site Agreement for Signature',
    body: (data) => `Hi ${data.contactName},\n\nA Site Agreement has been sent for your review and signature via PandaDoc.\n\nPlease review and sign at your earliest convenience.\n\nBest regards,\nMCG Career Services`,
  },
};

async function sendEmail(triggerType, recipient, data, studentId = null, hostId = null) {
  const template = EMAIL_TEMPLATES[triggerType];
  if (!template) {
    console.error(`Unknown email trigger: ${triggerType}`);
    return;
  }

  const subject = template.subject;
  const body = template.body(data);

  if (isMock()) {
    console.log(`[MOCK EMAIL] To: ${recipient} | Subject: ${subject}`);
    console.log(`[MOCK EMAIL] Body: ${body.substring(0, 100)}...`);
  } else {
    // Live SendGrid integration
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient }] }],
          from: { email: process.env.SENDGRID_FROM_EMAIL },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });
    } catch (err) {
      console.error('SendGrid error:', err);
    }
  }

  // Log to email_log
  await db.query(
    `INSERT INTO email_log (trigger_type, recipient, student_id, host_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [triggerType, recipient, studentId, hostId, JSON.stringify({ subject, mock: isMock() })]
  );
}

function getTemplates() {
  return Object.entries(EMAIL_TEMPLATES).map(([key, val]) => ({
    trigger_type: key,
    subject: val.subject,
  }));
}

module.exports = { sendEmail, getTemplates, EMAIL_TEMPLATES };
