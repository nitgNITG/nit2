-- Custom domain (Phase 2, owner self-serve).
ALTER TABLE `Academy`
  ADD COLUMN `customDomain` VARCHAR(191) NULL,
  ADD COLUMN `domainStatus` VARCHAR(191) NOT NULL DEFAULT 'none',
  ADD COLUMN `domainError` TEXT NULL;
CREATE UNIQUE INDEX `Academy_customDomain_key` ON `Academy`(`customDomain`);
