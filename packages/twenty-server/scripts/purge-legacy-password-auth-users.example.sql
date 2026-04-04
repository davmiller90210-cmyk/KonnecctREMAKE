-- ---------------------------------------------------------------------------
-- DESTRUCTIVE: Intended only after migrating human sign-in to Clerk (or similar).
-- Take a full database backup before running ANY variant of this script.
-- Adjust table/column names and FK order for your schema and retention needs.
-- This repo uses TypeORM entities in core.* — verify dependencies (e.g. user_workspace,
-- workspace_member, app tokens) before execution. Prefer a maintenance window.
-- ---------------------------------------------------------------------------
--
-- Example: remove users that still have a legacy password hash (never ran Clerk exchange).
-- Uncomment and edit after review:
--
-- BEGIN;
-- DELETE FROM core."user_workspace" uw
-- USING core."user" u
-- WHERE uw."userId" = u.id AND u."passwordHash" IS NOT NULL;
-- DELETE FROM core."user" u WHERE u."passwordHash" IS NOT NULL;
-- COMMIT;

SELECT 1 AS readme_only_noop;
