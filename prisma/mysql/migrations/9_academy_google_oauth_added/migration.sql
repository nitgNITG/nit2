-- Bookkeeping flag: has THIS academy's Google OAuth redirect URI been added to
-- the Google Cloud console yet? Google offers no API/wildcard, so adding the
-- redirect URI is a manual per-academy step; the admin ticks this once done.
-- AlterTable
ALTER TABLE `Academy` ADD COLUMN `googleOauthAdded` BOOLEAN NOT NULL DEFAULT false;
