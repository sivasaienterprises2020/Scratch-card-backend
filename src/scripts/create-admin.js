import argon2 from 'argon2';
import { pool, query } from '../config/database.js';

const [fullName, email, password] = process.argv.slice(2);
if (!fullName || !email || !password) {
  console.error('Usage: npm run create-admin -- "Admin Name" admin@example.com "StrongPassword"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must have at least 8 characters');
  process.exit(1);
}

try {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const result = await query(
    `INSERT INTO admin_users (full_name, email, password_hash)
     VALUES ($1, lower($2), $3)
     RETURNING id, full_name, email, created_at`,
    [fullName, email, hash]
  );
  console.log('Admin created:', result.rows[0]);
} catch (error) {
  console.error('Could not create admin:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
