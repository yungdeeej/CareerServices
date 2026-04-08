import React from 'react';

const FULL_DOC_PROGRAMS = ['BMT', 'AMT', 'MOA'];

const DOC_FIELDS = [
  { key: 'doc_first_aid', label: 'First Aid' },
  { key: 'doc_pic', label: 'PIC' },
  { key: 'doc_immunization', label: 'Immunization' },
  { key: 'doc_resume', label: 'Resume' },
];

export default function DocChecklist({ student, programCode, onToggle, readonly = false }) {
  const requiredDocs = FULL_DOC_PROGRAMS.includes(programCode)
    ? DOC_FIELDS
    : DOC_FIELDS.filter((d) => d.key === 'doc_resume');

  const verifiedCount = requiredDocs.filter((d) => student[d.key]).length;

  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">
        {verifiedCount} / {requiredDocs.length} docs confirmed
      </div>
      <div className="flex flex-wrap gap-2">
        {requiredDocs.map((doc) => (
          <label
            key={doc.key}
            className={`flex items-center gap-1.5 text-sm cursor-pointer ${
              student[doc.key] ? 'text-green-400' : 'text-gray-400'
            }`}
          >
            <input
              type="checkbox"
              checked={!!student[doc.key]}
              onChange={() => !readonly && onToggle && onToggle(doc.key, !student[doc.key])}
              disabled={readonly}
              className="rounded border-dark-border bg-dark-bg text-accent-blue focus:ring-accent-blue"
            />
            {student[doc.key] ? '✅' : '⬜'} {doc.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function getDocSummary(student, programCode) {
  const required = FULL_DOC_PROGRAMS.includes(programCode)
    ? DOC_FIELDS
    : DOC_FIELDS.filter((d) => d.key === 'doc_resume');
  const verified = required.filter((d) => student[d.key]).length;
  return { verified, total: required.length };
}
