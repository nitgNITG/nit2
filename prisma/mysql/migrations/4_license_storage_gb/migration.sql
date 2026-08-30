-- Per-licence moodledata storage quota (GB). New academies read this; the hourly
-- saas-quota.sh enforcer uses it (falls back to tier defaults when unset).
-- AlterTable
ALTER TABLE `License` ADD COLUMN `storageGb` INTEGER NOT NULL DEFAULT 1;

-- Backfill the originally-seeded tiers to sensible defaults (matches
-- provisioning/saas-quota.sh). Custom licences keep the column default (1 GB)
-- until an admin edits them.
UPDATE `License` SET `storageGb` = 5   WHERE `key` = 'basic';
UPDATE `License` SET `storageGb` = 20  WHERE `key` = 'standard';
UPDATE `License` SET `storageGb` = 100 WHERE `key` = 'professional';
