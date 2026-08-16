CREATE TABLE IF NOT EXISTS risk_scores (
  account_id TEXT PRIMARY KEY,
  score DOUBLE PRECISION NOT NULL,
  contributing_rules JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_scores_score_idx ON risk_scores (score DESC);
