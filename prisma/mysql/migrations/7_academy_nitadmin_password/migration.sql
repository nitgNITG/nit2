-- Encrypted random password for the NIT super-admin `admin` account, kept so NIT
-- support can log in to debug a broken academy. Separate from adminPasswordEnc
-- (which now holds the customer's OWNER password). Nullable; existing academies
-- stay NULL (their admin account predates the restricted-owner model).
-- AlterTable
ALTER TABLE `Academy` ADD COLUMN `nitAdminPasswordEnc` TEXT NULL;
