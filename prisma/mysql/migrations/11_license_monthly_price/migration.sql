-- Monthly billing option as a COLUMN on the tier (instead of a separate row).
-- priceEgp stays the ANNUAL price; priceEgpMonthly is the monthly one (0 = no
-- monthly option). Monthly term is a fixed 30 days.
ALTER TABLE `License` ADD COLUMN `priceEgpMonthly` INTEGER NOT NULL DEFAULT 0;
