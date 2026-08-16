import bcrypt from 'bcryptjs';
import { closePool, getPool } from './postgres.js';
import { upsertUser } from '../repositories/userRepository.js';

// Dev-only seed data. Never reuse these credentials outside local development.
const DEV_USERS = [
  { username: 'admin', password: 'admin_dev_password', role: 'admin' as const },
  { username: 'analyst', password: 'analyst_dev_password', role: 'analyst' as const }
];

async function main(): Promise<void> {
  const pool = getPool();
  try {
    for (const user of DEV_USERS) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await upsertUser(pool, { username: user.username, passwordHash, role: user.role });
      // eslint-disable-next-line no-console
      console.log(`Seeded user: ${user.username} (${user.role})`);
    }
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
