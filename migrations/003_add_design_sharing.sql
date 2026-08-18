-- View-only sharing for designs (Interfaces).
--
-- Mirrors the saved_projects sharing model: share_uuid is minted on first share
-- and re-minted on every re-share, is_share_enabled is the kill switch a revoke
-- flips, and the uuid is deliberately retained on revoke so the row keeps its
-- history while the old link stops resolving.
--
-- Idempotent so it is safe to re-run against a database where the columns were
-- already pushed via drizzle-kit.

ALTER TABLE designs ADD COLUMN IF NOT EXISTS share_uuid varchar;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS is_share_enabled boolean DEFAULT false;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS last_shared_at timestamp;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'designs_share_uuid_unique'
  ) THEN
    ALTER TABLE designs ADD CONSTRAINT designs_share_uuid_unique UNIQUE (share_uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_designs_share_uuid" ON designs (share_uuid);
