-- Optional list/regular prices for strikethrough discount display.
ALTER TABLE `License`
  ADD COLUMN `listPriceEgp` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `listPriceEgpMonthly` INTEGER NOT NULL DEFAULT 0;
