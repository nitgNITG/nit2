-- Per-package toggle: push the shared Kashier gateway config to academies on
-- this licence. Video provider is chosen by the existing videoSource column.
-- AlterTable
ALTER TABLE `License` ADD COLUMN `kashierEnabled` BOOLEAN NOT NULL DEFAULT false;

-- Sensible default: paid tiers get Kashier; demo does not.
UPDATE `License` SET `kashierEnabled` = true WHERE `key` IN ('basic', 'standard', 'professional');
