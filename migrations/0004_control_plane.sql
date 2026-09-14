CREATE TABLE IF NOT EXISTS control_interactions (
  id TEXT PRIMARY KEY, raw_text TEXT NOT NULL, route_json TEXT NOT NULL, plain_summary TEXT NOT NULL, project_id TEXT,
  route_kind TEXT NOT NULL CHECK(route_kind IN ('state_update','decision','side_idea','temporary_context')),
  responsibility TEXT NOT NULL CHECK(responsibility IN ('needs_ashley','ai_can_handle')),
  confidence TEXT NOT NULL CHECK(confidence IN ('high','medium','low')), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_control_interactions_created ON control_interactions(created_at DESC);
CREATE TABLE IF NOT EXISTS control_queue_items (
  id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL REFERENCES control_interactions(id),
  responsibility TEXT NOT NULL CHECK(responsibility IN ('needs_ashley','ai_can_handle')),
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','failed')),
  plain_summary TEXT NOT NULL, why TEXT, proposal_json TEXT NOT NULL, resolution_note TEXT, technical_receipt_json TEXT, created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_control_queue_pending ON control_queue_items(status,responsibility,created_at DESC);
