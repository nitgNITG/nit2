-- Email verification + password-reset via one-time codes (nodemailer/SMTP).

-- User: verified flag. Existing accounts are grandfathered as verified so the new
-- flow never locks anyone out; new sign-ups default to unverified.
ALTER TABLE `User` ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false;
UPDATE `User` SET `emailVerified` = true;

-- Short-lived one-time codes (stored hashed).
CREATE TABLE `EmailOtp` (
    `id`        VARCHAR(191) NOT NULL,
    `email`     VARCHAR(191) NOT NULL,
    `purpose`   VARCHAR(191) NOT NULL,
    `codeHash`  VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumed`  BOOLEAN NOT NULL DEFAULT false,
    `attempts`  INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `EmailOtp_email_purpose_idx`(`email`, `purpose`),
    INDEX `EmailOtp_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
