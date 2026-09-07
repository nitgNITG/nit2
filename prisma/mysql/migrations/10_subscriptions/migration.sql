-- Auto-renew subscriptions (Kashier pay-with-token). Dormant unless
-- SUBSCRIPTIONS_ENABLED=1 — these tables just sit empty until the feature is on.

-- Payment: link a charge to its subscription + billing window (idempotent retries).
ALTER TABLE `Payment`
    ADD COLUMN `subscriptionId` VARCHAR(191) NULL,
    ADD COLUMN `billingCycle`   VARCHAR(191) NULL;
CREATE INDEX `Payment_subscriptionId_idx` ON `Payment`(`subscriptionId`);

-- One recurring subscription per academy.
CREATE TABLE `Subscription` (
    `id`               VARCHAR(191) NOT NULL,
    `academySlug`      VARCHAR(191) NOT NULL,
    `userId`           VARCHAR(191) NOT NULL,
    `licenseKey`       VARCHAR(191) NOT NULL,
    `status`           VARCHAR(191) NOT NULL DEFAULT 'active',
    `autoRenew`        BOOLEAN NOT NULL DEFAULT true,
    `intervalDays`     INTEGER NOT NULL,
    `amountEgp`        INTEGER NOT NULL,
    `currency`         VARCHAR(191) NOT NULL DEFAULT 'EGP',
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `nextAttemptAt`    DATETIME(3) NULL,
    `attemptCount`     INTEGER NOT NULL DEFAULT 0,
    `lastError`        TEXT NULL,
    `canceledAt`       DATETIME(3) NULL,
    `consentAt`        DATETIME(3) NULL,
    `paymentMethodId`  VARCHAR(191) NULL,
    `createdAt`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`        DATETIME(3) NOT NULL,
    UNIQUE INDEX `Subscription_academySlug_key`(`academySlug`),
    INDEX `Subscription_status_idx`(`status`),
    INDEX `Subscription_nextAttemptAt_idx`(`nextAttemptAt`),
    INDEX `Subscription_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Saved card tokens (card-on-file). Stores only the encrypted opaque token.
CREATE TABLE `PaymentMethod` (
    `id`                VARCHAR(191) NOT NULL,
    `userId`            VARCHAR(191) NOT NULL,
    `customerReference` VARCHAR(191) NOT NULL,
    `cardTokenEnc`      TEXT NOT NULL,
    `brand`             VARCHAR(191) NULL,
    `last4`             VARCHAR(191) NULL,
    `expMonth`          INTEGER NULL,
    `expYear`           INTEGER NULL,
    `isDefault`         BOOLEAN NOT NULL DEFAULT true,
    `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `PaymentMethod_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
