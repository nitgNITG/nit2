-- Tracks which pre-expiry reminder emails (7/3/1 days + on-expiry) were already
-- sent for the current subscription term, so the daily cron doesn't re-send.
-- JSON object like {"d7":<epoch>,"d3":…}; cleared on renewal / plan change.
-- AlterTable
ALTER TABLE `Academy` ADD COLUMN `expiryRemindersSent` JSON NULL;
