-- CreateTable
CREATE TABLE `License` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `price` INTEGER NOT NULL DEFAULT 0,
    `durationDays` INTEGER NOT NULL DEFAULT 365,
    `maxCourses` INTEGER NOT NULL DEFAULT -1,
    `maxTeachers` INTEGER NOT NULL DEFAULT -1,
    `maxAcademies` INTEGER NOT NULL DEFAULT 1,
    `videoSource` VARCHAR(191) NOT NULL DEFAULT 'all',
    `limits` JSON NOT NULL,
    `features` JSON NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `License_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

