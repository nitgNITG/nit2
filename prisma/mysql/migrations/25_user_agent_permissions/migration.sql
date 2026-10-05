-- AI agent staff permissions (SRS 13.3 / D12): a nullable JSON array of
-- "sales" | "support" | "viewer". Nullable, so existing rows and code are
-- unaffected; rollback = leave the column in place (unused while the agent is off).
-- AlterTable
ALTER TABLE `User` ADD COLUMN `agentPermissions` JSON NULL;
