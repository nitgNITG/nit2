-- Formal payout history + live/test mode on the revenue ledger.
-- AlterTable
ALTER TABLE `AcademyRevenue`
    ADD COLUMN `mode` VARCHAR(191) NOT NULL DEFAULT 'live',
    ADD COLUMN `settlementId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AcademyRevenue_mode_idx` ON `AcademyRevenue`(`mode`);
CREATE INDEX `AcademyRevenue_settlementId_idx` ON `AcademyRevenue`(`settlementId`);

-- CreateTable
CREATE TABLE `Settlement` (
    `id` VARCHAR(191) NOT NULL,
    `academySlug` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `txnCount` INTEGER NOT NULL DEFAULT 0,
    `method` VARCHAR(191) NOT NULL DEFAULT 'bank',
    `reference` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Settlement_academySlug_idx`(`academySlug`),
    INDEX `Settlement_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
