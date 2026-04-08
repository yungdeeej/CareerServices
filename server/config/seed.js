require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const seed = async () => {
  try {
    console.log('Seeding database...');

    // Seed programs
    await db.query(`
      INSERT INTO programs (code, name, hours_required) VALUES
        ('BMT',  'Basic Massage Therapy',               56),
        ('AMT',  'Advanced Massage Therapy',            280),
        ('MOA',  'Medical Office Assistant',            150),
        ('AT',   'Architectural Technology',            120),
        ('GOSC', 'Global Operations and Supply Chain', 200)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Seed admin accounts
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    await db.query(`
      INSERT INTO users (email, password_hash, full_name, role) VALUES
        ('dj.gupta@mcgcollege.com', $1, 'DJ Gupta', 'admin'),
        ('ahmed.baker@mcgcollege.com', $1, 'Ahmad Baker', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, [passwordHash]);

    console.log('Seed completed successfully.');
    console.log('Default admin credentials:');
    console.log('  Email: dj.gupta@mcgcollege.com');
    console.log('  Email: ahmed.baker@mcgcollege.com');
    console.log('  Password: Admin@123');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
