-- Live/test mode for NIT's own licence checkout, recorded on each Payment so the
-- platform revenue can be split by mode too.
-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `mode` VARCHAR(191) NOT NULL DEFAULT 'live';
