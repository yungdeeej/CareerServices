require('dotenv').config();
const db = require('./db');

const migrate = async () => {
  try {
    console.log('Running migrations...');

    await db.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'pc');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE agreement_status AS ENUM ('none', 'sent', 'host_signed', 'executed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE practicum_status AS ENUM ('pre_req', 'ready', 'active', 'completing', 'complete');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE email_trigger AS ENUM (
          'doc_reminder', 'ready_to_launch_60', 'ready_to_launch_30',
          'weekly_pulse', 'completion_congrats', 'grading_pack',
          'exit_survey', 'host_nurture', 'agreement_sent'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS programs (
        id              SERIAL PRIMARY KEY,
        code            VARCHAR(20) UNIQUE NOT NULL,
        name            VARCHAR(100) NOT NULL,
        hours_required  INTEGER NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        email           VARCHAR(150) UNIQUE NOT NULL,
        password_hash   VARCHAR(255) NOT NULL,
        full_name       VARCHAR(100) NOT NULL,
        role            user_role NOT NULL DEFAULT 'pc',
        is_active       BOOLEAN DEFAULT true,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS hosts (
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
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS students (
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
        doc_first_aid           BOOLEAN DEFAULT false,
        doc_pic                 BOOLEAN DEFAULT false,
        doc_immunization        BOOLEAN DEFAULT false,
        doc_resume              BOOLEAN DEFAULT false,
        imported_via_csv        BOOLEAN DEFAULT false,
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        updated_at              TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS hours_log (
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
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS email_log (
        id            SERIAL PRIMARY KEY,
        trigger_type  email_trigger NOT NULL,
        recipient     VARCHAR(150) NOT NULL,
        student_id    INTEGER REFERENCES students(id),
        host_id       INTEGER REFERENCES hosts(id),
        sent_at       TIMESTAMPTZ DEFAULT NOW(),
        status        VARCHAR(20) DEFAULT 'sent',
        metadata      JSONB
      );
    `);

    // Indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_students_pc ON students(assigned_pc_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_students_practicum_start ON students(practicum_start_date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_hours_student ON hours_log(student_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_email_log_student ON email_log(student_id);`);

    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
