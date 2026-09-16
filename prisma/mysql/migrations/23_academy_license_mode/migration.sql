-- Which Kashier credentials the academy's LICENCE was bought with: live | test |
-- NULL (free / not paid). Distinguishes test academies from real paying ones.
-- AlterTable
ALTER TABLE `Academy` ADD COLUMN `licenseMode` VARCHAR(191) NULL;
