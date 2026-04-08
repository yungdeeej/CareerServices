# MCG Career Services Portal — Build Specification
**Prepared for:** Neha Arora (Career Services) & DJ Gupta (Dean of Operations)
**Date:** April 8, 2026
**Scope:** MCG Career College — Calgary, Red Deer, Cold Lake, Edmonton
**Purpose:** This document serves as both the technical build specification for development and the functional approval document for Career Services sign-off.

---

## Overview

Build a full-stack **Career Services Portal** for MCG Career College that centralizes practicum tracking, document collection, host/site management, and student offboarding. The system replaces fragmented spreadsheets and manual processes with a structured, automated workflow covering the full practicum lifecycle — from pre-requisite document collection through to final grade release.

This is a **standalone internal tool** (no HubSpot or Salesforce integration at launch). It must be architected to support a future Salesforce connection via a `salesforce_id` field on student records.

---

## Tech Stack

- **Frontend:** React + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT-based, role-based access control
- **Email:** SendGrid (transactional + automated)
- **Contracts:** PandaDoc API
- **Hosting:** Replit or DigitalOcean
- **Design:** Dark mode UI, clean dashboard aesthetic, consistent with MCG internal tooling

---

## User Roles

| Role | Description | Access Level |
|---|---|---|
| **Admin** | DJ Gupta, Ahmad Baker | Full access — all campuses, all programs, all students, settings, CSV import, PandaDoc, reporting |
| **PC (Practicum Coordinator)** | Dedicated Career Services staff (e.g. Neha Arora) | Scoped to their assigned student cohort only — doc management, hours tracking, placement, alerts |

> Student-facing portal is **deferred to v2**. All data entry (doc uploads, hours) is managed by PCs in v1.

---

## Programs & Requirements

| Code | Full Name | Hours Required | Required Documents |
|---|---|---|---|
| BMT | Basic Massage Therapy | 56 hrs | First Aid, PIC, Immunization, Resume |
| AMT | Advanced Massage Therapy | 280 hrs | First Aid, PIC, Immunization, Resume |
| MOA | Medical Office Assistant | 150 hrs | First Aid, PIC, Immunization, Resume |
| AT | Architectural Technology | 120 hrs | Resume only |
| GOSC | Global Operations and Supply Chain | 200 hrs | Resume only |

Document tracking is **manual checkbox-based** — PCs check off documents as confirmed. CampusLogin is the source of truth for the actual documents; this portal only tracks confirmation status. The system shows the correct checkboxes based on program: BMT/AMT/MOA see 4 checkboxes, AT/GOSC see Resume only. Reminder emails only reference documents the student's program requires.

---

## Database Schema

### `programs`
```sql
CREATE TABLE programs (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  hours_required  INTEGER NOT NULL
);

INSERT INTO programs (code, name, hours_required) VALUES
  ('BMT',  'Basic Massage Therapy',                 56),
  ('AMT',  'Advanced Massage Therapy',             280),
  ('MOA',  'Medical Office Assistant',             150),
  ('AT',   'Architectural Technology',             120),
  ('GOSC', 'Global Operations and Supply Chain',  200);
```

### `program_doc_requirements`

No separate table needed. Doc requirements are hardcoded by program group:
- **BMT, AMT, MOA** → 4 checkboxes: `doc_first_aid`, `doc_pic`, `doc_immunization`, `doc_resume`
- **AT, GOSC** → 1 checkbox: `doc_resume` only

The UI renders only the relevant checkboxes based on the student's program. All 4 boolean fields exist on the `students` table; irrelevant fields are hidden in the UI and ignored in status logic.

### `users`
```sql
CREATE TYPE user_role AS ENUM ('admin', 'pc');

CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(150) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  role            user_role NOT NULL DEFAULT 'pc',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `hosts`
```sql
CREATE TYPE agreement_status AS ENUM ('none', 'sent', 'host_signed', 'executed');

CREATE TABLE hosts (
  id                        SERIAL PRIMARY KEY,
  org_name                  VARCHAR(150) NOT NULL,
  contact_name              VARCHAR(100),
  contact_email             VARCHAR(150),
  contact_phone             VARCHAR(30),
  address                   TEXT,
  campus_region             VARCHAR(50),
  programs_accepted         VARCHAR(20)[],
  capacity                  INTEGER,
  is_active                 BOOLEAN DEFAULT true,

  agreement_status          agreement_status DEFAULT 'none',
  agreement_doc_url         VARCHAR(500),
  agreement_sent_date       DATE,
  agreement_executed_date   DATE,
  agreement_expires_date    DATE,
  pandadoc_document_id      VARCHAR(100),

  last_nurture_email_sent   TIMESTAMPTZ,
  availability_confirmed    BOOLEAN DEFAULT false,
  availability_updated_at   TIMESTAMPTZ,

  created_at                TIMESTAMPTZ DEFAULT NOW()
);
```

### `students`
```sql
CREATE TYPE practicum_status AS ENUM (
  'pre_req',
  'ready',
  'active',
  'completing',
  'complete'
);

CREATE TABLE students (
  id                      SERIAL PRIMARY KEY,
  campus_login_id         VARCHAR(50) UNIQUE,
  salesforce_id           VARCHAR(50),
  salesforce_sync_status  VARCHAR(20) DEFAULT 'not_synced',

  first_name              VARCHAR(80) NOT NULL,
  last_name               VARCHAR(80) NOT NULL,
  email                   VARCHAR(150) UNIQUE NOT NULL,
  phone                   VARCHAR(30),

  program_id              INTEGER REFERENCES programs(id),
  campus                  VARCHAR(50),
  cohort_start_date       DATE,
  practicum_start_date    DATE,
  practicum_end_date      DATE,

  assigned_pc_id          INTEGER REFERENCES users(id),
  host_id                 INTEGER REFERENCES hosts(id),

  status                  practicum_status DEFAULT 'pre_req',
  hours_required          INTEGER NOT NULL,
  hours_logged            NUMERIC(6,2) DEFAULT 0,

  grading_pack_sent       BOOLEAN DEFAULT false,
  timesheet_uploaded      BOOLEAN DEFAULT false,
  final_eval_uploaded     BOOLEAN DEFAULT false,
  exit_survey_submitted   BOOLEAN DEFAULT false,
  grade_released          BOOLEAN DEFAULT false,

  launch_meeting_booked   BOOLEAN DEFAULT false,
  launch_meeting_date     TIMESTAMPTZ,

  -- Document confirmation checkboxes (manual — CampusLogin is source of truth)
  -- BMT/AMT/MOA: all 4 fields used. AT/GOSC: only doc_resume used.
  doc_first_aid           BOOLEAN DEFAULT false,
  doc_pic                 BOOLEAN DEFAULT false,
  doc_immunization        BOOLEAN DEFAULT false,
  doc_resume              BOOLEAN DEFAULT false,

  imported_via_csv        BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### `hours_log`
```sql
CREATE TABLE hours_log (
  id                SERIAL PRIMARY KEY,
  student_id        INTEGER REFERENCES students(id) ON DELETE CASCADE,
  week_ending_date  DATE NOT NULL,
  hours_submitted   NUMERIC(4,2) NOT NULL,
  supervisor_name   VARCHAR(100),
  notes             TEXT,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  approved_by       INTEGER REFERENCES users(id),
  approved_at       TIMESTAMPTZ
);
```

### `email_log`
```sql
CREATE TYPE email_trigger AS ENUM (
  'doc_reminder',
  'ready_to_launch_60',
  'ready_to_launch_30',
  'weekly_pulse',
  'completion_congrats',
  'grading_pack',
  'exit_survey',
  'host_nurture',
  'agreement_sent'
);

CREATE TABLE email_log (
  id            SERIAL PRIMARY KEY,
  trigger_type  email_trigger NOT NULL,
  recipient     VARCHAR(150) NOT NULL,
  student_id    INTEGER REFERENCES students(id),
  host_id       INTEGER REFERENCES hosts(id),
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  status        VARCHAR(20) DEFAULT 'sent',
  metadata      JSONB
);
```

### Indexes
```sql
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_pc ON students(assigned_pc_id);
CREATE INDEX idx_students_practicum_start ON students(practicum_start_date);
CREATE INDEX idx_hours_student ON hours_log(student_id);
CREATE INDEX idx_email_log_student ON email_log(student_id);
```

---

## Application Modules

### Module 1 — Authentication
- JWT-based login
- Role-based route protection (admin vs. pc)
- PCs can only access their assigned students — enforced at the API level, not just UI
- Session expiry + refresh token handling
- Seed two default admin accounts: `dj.gupta@mcgcollege.com`, `ahmed.baker@mcgcollege.com`

---

### Module 2 — Student Management

**Admin can:**
- Create students manually via form
- Bulk import via CSV upload (see CSV spec below)
- View all students across all campuses and programs
- Assign/reassign PCs
- Edit any student record
- Filter by: status, program, campus, PC, practicum date range

**PC can:**
- View only their assigned students
- Update doc status (upload, verify, reject with notes)
- Log hours on behalf of students
- Update host assignment
- Mark launch meeting as booked

**Student Status State Machine:**

```
pre_req → ready        (all required docs verified)
ready   → active       (practicum start date reached + host assigned)
active  → completing   (hours_logged >= hours_required)
completing → complete  (exit_survey_submitted = true)
```

Status advances automatically based on these conditions. PCs can manually override status with an admin-visible audit note.

**CSV Import Spec:**
```
campus_login_id, first_name, last_name, email, phone,
program_code, campus, cohort_start_date, practicum_start_date,
assigned_pc_email, host_id (optional), hours_required,
doc_first_aid (Y/N), doc_pic (Y/N), doc_immunization (Y/N), doc_resume (Y/N)
```
- Validation on import: required fields, valid program codes, valid PC email
- Error report shown before committing — row-level feedback on failures
- `imported_via_csv = true` flagged on all imported records

---

### Module 3 — Document Tracking

Document tracking is **manual and checkbox-based**. CampusLogin is the source of truth for actual documents — this portal only tracks whether the PC has confirmed receipt.

**Per student, the UI renders:**
- **BMT / AMT / MOA students:** 4 checkboxes — First Aid ☐, PIC ☐, Immunization ☐, Resume ☐
- **AT / GOSC students:** 1 checkbox — Resume ☐

**Behaviour:**
- PC checks off each document as they confirm it in CampusLogin
- Checkboxes are editable by PC and Admin — no upload, no verification workflow, no file storage
- The `pre_req → ready` status transition fires automatically when all required checkboxes for that student's program are checked
- Doc reminder emails reference only the unchecked documents for that student's program

**UI display on student profile:**
- Simple checkbox row per required document
- Checked = ✅, Unchecked = ⬜
- Documents not required by the student's program are hidden entirely (not shown as N/A)

---

### Module 4 — Host / Practicum Site Library

**Host record fields:** org name, contact name, contact email, phone, address, campus region, programs accepted, capacity, active status, site agreement status.

**Site Agreement flow (PandaDoc):**
- Admin clicks "Send Site Agreement" on a host record
- PandaDoc document auto-populated with: host org name, host contact name, host contact email, practicum program types, agreement date
- Signing order: **Host Contact signs first → MCG Dean signs second**
- Student is **not involved** in this agreement — it is a one-time B2B contract per practicum site
- PandaDoc webhook updates host record on completion:
  - `agreement_status = 'executed'`
  - `agreement_doc_url` = completed document link
  - `agreement_executed_date` = timestamp
- Host badge displays:
  - 🔴 No Agreement
  - 🟡 Sent / Awaiting Signature
  - 🟠 Host Signed — Awaiting Dean
  - 🟢 Executed — Active Partner
- **Hard block:** PCs cannot assign a student to a host unless `agreement_status = 'executed'`

**Monthly Nurture Email (automated):**
- Sent to all active host contacts on the 1st of each month
- Two CTAs: (1) Confirm availability for an upcoming student, (2) Post a job opening for MCG alumni
- Response updates `availability_confirmed` and `availability_updated_at` on the host record

---

### Module 5 — Hours Tracker

- PC logs weekly hours on behalf of student: week ending date, hours worked, supervisor name, optional notes
- Running `hours_logged` total updates on each entry
- When `hours_logged >= hours_required` → **Completion Trigger fires automatically**
- PC dashboard shows hours progress bar per student (e.g. 112 / 150 hrs)
- Alert shown if no hours submitted in the current week for active students

---

### Module 6 — Email Automation Engine

All emails sent via SendGrid. A cron job runs daily to evaluate trigger conditions.

| Trigger | Condition | Recipient | Action |
|---|---|---|---|
| `doc_reminder` | Monthly, any required doc checkbox unchecked | Student email | Segmented reminder — only lists unchecked docs for their program |
| `ready_to_launch_60` | 60 days before `practicum_start_date`, docs not all verified | Student + PC | Email with Calendly/MS Bookings link for mandatory 15-min sync |
| `ready_to_launch_30` | 30 days before `practicum_start_date`, `launch_meeting_booked = false` | Student + PC | Reminder booking email |
| `weekly_pulse` | Every Friday, student status = `active` | Student | "How's it going?" check-in with hours submission prompt |
| `completion_congrats` | `hours_logged >= hours_required` | Student | Congratulations email — step 1 of completion sequence |
| `grading_pack` | Fires 10 minutes after completion trigger | Student | Direct upload links for Signed Timesheet + Final Evaluation |
| `exit_survey` | Fires after grading pack | Student | Grad Exit Survey link — note: grade not released until survey submitted |
| `host_nurture` | 1st of each month | All active host contacts | Availability confirmation + alumni job posting CTA |
| `agreement_sent` | Admin sends PandaDoc agreement | Host contact | PandaDoc signature request (handled by PandaDoc — log the event) |

All sent emails are logged to `email_log` with `trigger_type`, recipient, timestamp, and relevant metadata.

---

### Module 7 — PC Dashboard

**Default view when PC logs in:**

- Student list filtered to their cohort
- Status badge per student: Pre-Req Incomplete / Ready / Active / Completing / Done
- Hours progress bar vs. required threshold
- Doc confirmation summary per student (e.g. 3 / 4 docs confirmed) with inline checkboxes accessible without leaving the list view
- Alert queue at top of page:
  - Students with no hours submitted this week
  - Students with unchecked required docs
  - Students at T-60 or T-30 with unbooked launch meeting
  - Students in `completing` status with grading pack not yet returned

---

### Module 8 — Admin Dashboard

**Summary panel at top:**
- Total active students (all campuses)
- Students by status (breakdown across all programs)
- Hosts with no executed agreement
- Completion rate (last 90 days)

**Full student table:**
- Cross-campus, cross-program
- Filters: status, program, campus, PC, date range
- Bulk actions: send reminder, reassign PC, export to CSV

**Host table:**
- All hosts with agreement status badges
- Filter by campus region, program, agreement status

**Reporting:**
- Average days from enrollment to practicum start
- Average days to complete hours (by program)
- Completion rate by program and by PC

---

### Module 9 — Settings (Admin only)

- User management: create/deactivate PC accounts, reset passwords
- Program configuration: view programs and hour thresholds (read-only in v1)
- Email template management: edit subject lines and body copy for each trigger type
- `INTEGRATION_MODE` toggle: `mock` (uses dummy data, no real emails sent) vs. `live`
- PandaDoc API key configuration
- SendGrid API key configuration

---

## API Route Structure

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/students
POST   /api/students
POST   /api/students/import-csv
GET    /api/students/:id
PUT    /api/students/:id
DELETE /api/students/:id

PATCH  /api/students/:id/docs          -- update doc checkboxes (body: { doc_first_aid, doc_pic, doc_immunization, doc_resume })

GET    /api/students/:id/hours
POST   /api/students/:id/hours

GET    /api/hosts
POST   /api/hosts
GET    /api/hosts/:id
PUT    /api/hosts/:id
POST   /api/hosts/:id/send-agreement
GET    /api/hosts/:id/agreement-status

GET    /api/programs

GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

GET    /api/reports/summary
GET    /api/reports/completion-rates
GET    /api/reports/doc-bottlenecks

POST   /api/webhooks/pandadoc
```

---

## Automation / Cron Jobs

```
Daily  @ 8:00 AM MT  → evaluate all email triggers (T-60, T-30, completion, doc reminders)
Weekly @ Friday 3PM MT → send weekly pulse checks to all active students
Monthly @ 1st @ 9AM MT → send host nurture emails
```

---

## UI / Design Spec

- **Theme:** Dark mode
- **Layout:** Sidebar navigation (left), main content area (right)
- **Sidebar links:** Dashboard, Students, Hosts, Reports, Settings
- **Color palette:** Dark background (#0F1117 or similar), white text, green accent for verified/complete states, amber for pending/warning, red for blocked/missing
- **Student status badges:** Pill-style colour-coded labels
- **Doc checklist:** Per-student checkbox rows (program-driven) — PC checks off as confirmed in CampusLogin
- **Hours tracker:** Simple log table + progress bar
- **Host library:** Card or table view with prominent agreement status badge
- **Responsive:** Desktop-first (internal tool — staff use laptops)
- Include an `INTEGRATION_MODE` banner at the top of every page when running in mock mode (yellow bar: "Running in Mock Mode — No emails will be sent")

---

## Out of Scope for v1

- Student-facing login or self-serve portal
- HubSpot or Salesforce integration (future — `salesforce_id` field is a placeholder)
- Document file storage or upload functionality (CampusLogin is source of truth)
- InFocus Film School or any college other than MCG
- Mobile-optimized UI
- Document expiry tracking or renewal alerts
- Multi-language support

---

## Approval Checklist

*For Neha Arora — Career Services Sign-Off*

Before development begins, please confirm the following:

- [ ] Program list and hours are correct (BMT 56, AMT 280, MOA 150, AT 120, GOSC 200)
- [ ] Document requirements per program are correct
- [ ] The Site Agreement signing order is correct (Host signs → Dean signs)
- [ ] The booking link for "Ready to Launch" emails will be a Calendly or MS Bookings link (please provide URL)
- [ ] The Grad Exit Survey link exists or will be created (please provide URL or confirm platform — Google Forms, Typeform, etc.)
- [ ] The weekly hours pulse email going to students on Fridays is acceptable
- [ ] Grade release being gated on Exit Survey submission is confirmed as the correct policy
- [ ] Confirm which email address the automated emails should send from (e.g. careerservices@mcgcollege.com)
- [ ] Confirm PC staff names and email addresses for initial user account seeding

---

*Document prepared by DJ Gupta, Dean of Operations — MCG Career College Group*
*April 8, 2026*
