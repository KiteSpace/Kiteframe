-- Migration: add designs table for craft.js design canvas
-- This table stores craft.js serialized state for first-class designs.
-- Old external_entities records with entityType='design' remain in external_entities
-- and are served by the existing /api/public/entities/designs/:id endpoint unchanged.

CREATE TABLE IF NOT EXISTS designs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  claimed_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'native',
  api_key_id VARCHAR REFERENCES external_api_keys(id) ON DELETE SET NULL,
  craft_state JSONB NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_designs_claimed_by_user" ON designs(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS "IDX_designs_source" ON designs(source);
CREATE INDEX IF NOT EXISTS "IDX_designs_created_at" ON designs(created_at);
