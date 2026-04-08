// Program groups for document requirements
const FULL_DOC_PROGRAMS = ['BMT', 'AMT', 'MOA'];
const RESUME_ONLY_PROGRAMS = ['AT', 'GOSC'];

function getRequiredDocs(programCode) {
  if (FULL_DOC_PROGRAMS.includes(programCode)) {
    return ['doc_first_aid', 'doc_pic', 'doc_immunization', 'doc_resume'];
  }
  return ['doc_resume'];
}

function allDocsVerified(student, programCode) {
  const required = getRequiredDocs(programCode);
  return required.every(doc => student[doc] === true);
}

/**
 * Evaluate and return the correct status based on current student data.
 * Status transitions:
 *   pre_req → ready        (all required docs verified)
 *   ready   → active       (practicum_start_date reached + host assigned)
 *   active  → completing   (hours_logged >= hours_required)
 *   completing → complete  (exit_survey_submitted = true)
 */
function evaluateStatus(student, programCode) {
  const now = new Date();

  // Check from highest status down to find where they belong
  if (
    student.exit_survey_submitted &&
    parseFloat(student.hours_logged) >= student.hours_required &&
    allDocsVerified(student, programCode)
  ) {
    return 'complete';
  }

  if (
    parseFloat(student.hours_logged) >= student.hours_required &&
    allDocsVerified(student, programCode)
  ) {
    return 'completing';
  }

  if (
    allDocsVerified(student, programCode) &&
    student.host_id &&
    student.practicum_start_date &&
    new Date(student.practicum_start_date) <= now
  ) {
    return 'active';
  }

  if (allDocsVerified(student, programCode)) {
    return 'ready';
  }

  return 'pre_req';
}

module.exports = {
  getRequiredDocs,
  allDocsVerified,
  evaluateStatus,
  FULL_DOC_PROGRAMS,
  RESUME_ONLY_PROGRAMS,
};
