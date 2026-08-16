CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('analyst', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
