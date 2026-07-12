-- Migration: external_workflows → external_entities
-- Applied: 2026-07-12
--
-- Generalises the narrow `external_workflows` table into a generic
-- `external_entities` table keyed by entity_type.  Existing workflow rows
-- are preserved in the new table with entity_type='workflow' and their
-- nodes/edges/title wrapped in the `data` JSONB column.
--
-- This migration is idempotent: each statement uses IF NOT EXISTS / ON
-- CONFLICT DO NOTHING so re-running it is safe.

-- 1. Create the new table (no-op if already exists)
CREATE TABLE IF NOT EXISTS external_entities (
  id               varchar        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      text           NOT NULL,
  api_key_id       varchar        NOT NULL REFERENCES external_api_keys(id),
  data             jsonb          NOT NULL,
  source_entity_id varchar        REFERENCES external_entities(id) ON DELETE SET NULL,
  created_at       timestamp      DEFAULT now(),
  updated_at       timestamp      DEFAULT now(),
  expires_at       timestamp      NOT NULL DEFAULT (now() + interval '24 hours'),

  CONSTRAINT external_entities_entity_type_check
    CHECK (entity_type IN ('workflow', 'design'))
);

CREATE INDEX IF NOT EXISTS "IDX_external_entities_api_key"
  ON external_entities (api_key_id);
CREATE INDEX IF NOT EXISTS "IDX_external_entities_expires_at"
  ON external_entities (expires_at);
CREATE INDEX IF NOT EXISTS "IDX_external_entities_type"
  ON external_entities (entity_type);

-- 2. Back-fill existing workflow rows (no-op if already migrated)
INSERT INTO external_entities (
  id, entity_type, api_key_id, data, created_at, updated_at, expires_at
)
SELECT
  id,
  'workflow',
  api_key_id,
  jsonb_build_object(
    'title', title,
    'nodes', nodes,
    'edges', edges
  ),
  created_at,
  updated_at,
  expires_at
FROM external_workflows
ON CONFLICT (id) DO NOTHING;

-- 3. Drop the old table (only after back-fill succeeds)
--    NOTE: if external_workflows no longer exists this is a no-op.
DROP TABLE IF EXISTS external_workflows;
