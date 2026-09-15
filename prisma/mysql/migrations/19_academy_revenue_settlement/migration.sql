-- Settlement bookkeeping on the revenue ledger: which mirrored payments have been
-- paid out to the academy owner (settled) vs still owed (outstanding). Manual admin
-- action; no money moves here.
-- AlterTable
ALTER TABLE `AcademyRevenue`
    ADD COLUMN `settled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `settledAt` DATETIME(3) NULL,
    ADD COLUMN `settlementRef` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AcademyRevenue_settled_idx` ON `AcademyRevenue`(`settled`);
