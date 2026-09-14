-- "Most popular" highlight flag for the pricing page.
ALTER TABLE `License` ADD COLUMN `popular` BOOLEAN NOT NULL DEFAULT false;
