-- "Contact sales" plans: shown with a Contact-us CTA and not directly purchasable.
ALTER TABLE `License` ADD COLUMN `contactSales` BOOLEAN NOT NULL DEFAULT false;
