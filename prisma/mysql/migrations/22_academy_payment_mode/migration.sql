-- NIT-controlled Kashier payment mode per academy (live | test | NULL = inherit the
-- platform default). Pushed to the academy's Moodle as payment_mode.
-- AlterTable
ALTER TABLE `Academy` ADD COLUMN `paymentMode` VARCHAR(191) NULL;
