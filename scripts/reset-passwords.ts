import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

async function resetPasswords() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const hashedPassword = await bcrypt.hash('samcor', 10);
    console.log('Generated hash for "samcor"');
    
    const result = await pool.query(
      'UPDATE users SET password = $1',
      [hashedPassword]
    );
    
    console.log(`Updated ${result.rowCount} user passwords to "samcor"`);
    
    // List the users so they know which emails they can use
    const users = await pool.query('SELECT email, role FROM users');
    console.log('\nUsers in the system:');
    users.rows.forEach(u => console.log(`  - ${u.email} (${u.role})`));
    
  } finally {
    await pool.end();
  }
}

resetPasswords().catch(console.error);
