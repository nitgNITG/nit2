-- Pre-renewal heads-up: remember when we told the owner "you'll be auto-charged
-- soon" so the daily cron sends it once per cycle (cleared on each charge).
ALTER TABLE `Subscription` ADD COLUMN `preRenewNotifiedAt` DATETIME(3) NULL;
