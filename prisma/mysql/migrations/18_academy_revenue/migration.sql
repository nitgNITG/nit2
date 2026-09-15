-- Central revenue ledger: a mirror of STUDENT payments made inside each academy's
-- Moodle, POSTed to /api/revenue/ingest. Reporting only (categorise revenue per
-- academy / provider / period in the dashboard); never the source of truth for money.
-- CreateTable
CREATE TABLE `AcademyRevenue` (
    `id` VARCHAR(191) NOT NULL,
    `academySlug` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'kashier',
    `orderId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EGP',
    `status` VARCHAR(191) NOT NULL DEFAULT 'paid',
    `kind` VARCHAR(191) NOT NULL DEFAULT 'course',
    `courseId` INTEGER NULL,
    `userRef` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcademyRevenue_academySlug_idx`(`academySlug`),
    INDEX `AcademyRevenue_paidAt_idx`(`paidAt`),
    INDEX `AcademyRevenue_provider_idx`(`provider`),
    INDEX `AcademyRevenue_status_idx`(`status`),
    UNIQUE INDEX `AcademyRevenue_academySlug_orderId_key`(`academySlug`, `orderId`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
