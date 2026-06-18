-- Remove the Google Maps import/sync feature: drop the related Restaurant
-- columns and the now-unused ImportProvider enum.

-- DropColumn
ALTER TABLE "Restaurant" DROP COLUMN IF EXISTS "importSource";
ALTER TABLE "Restaurant" DROP COLUMN IF EXISTS "googleSyncedAt";

-- DropEnum
DROP TYPE IF EXISTS "ImportProvider";
