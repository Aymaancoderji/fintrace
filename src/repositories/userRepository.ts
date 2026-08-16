import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export type UserRole = 'analyst' | 'admin';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export async function findUserByUsername(pool: Pool, username: string): Promise<User | undefined> {
  const result = await pool.query(
    'SELECT id, username, password_hash, role FROM users WHERE username = $1',
    [username]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role };
}

export async function upsertUser(
  pool: Pool,
  input: { username: string; passwordHash: string; role: UserRole }
): Promise<void> {
  await pool.query(
    `
    INSERT INTO users (id, username, password_hash, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
    `,
    [randomUUID(), input.username, input.passwordHash, input.role]
  );
}
