-- Per-licence app access (design_system site.supportedapp). Default true; the
-- Demo package is app-off. Existing rows default to true; Demo is set false so a
-- demo academy is refused at app onboarding.
-- AlterTable
ALTER TABLE `License` ADD COLUMN `supportedApp` BOOLEAN NOT NULL DEFAULT true;

UPDATE `License` SET `supportedApp` = false WHERE `key` = 'demo';
