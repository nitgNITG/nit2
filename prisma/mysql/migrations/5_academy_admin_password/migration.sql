-- Encrypted generated admin password for recovery (lost welcome email). Nullable;
-- existing academies stay NULL until their credentials are reset from the dashboard.
-- AlterTable
ALTER TABLE `Academy` ADD COLUMN `adminPasswordEnc` TEXT NULL;
