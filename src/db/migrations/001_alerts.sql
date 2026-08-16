CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY,
  rule_name TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  account_ids TEXT[] NOT NULL,
  transaction_ids TEXT[] NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_rule_name_idx ON alerts (rule_name);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at);
