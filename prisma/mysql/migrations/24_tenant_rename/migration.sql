-- ============================================================================
-- Tenant rename: the control plane now manages two products — academies
-- (Moodle) and stores (commerce) — with the same lifecycle, billing and
-- subscriptions. Tables/columns named after "academy" become product-neutral
-- and every row carries `product` ('academy' | 'store').
--
-- Pure metadata: RENAME TABLE / RENAME COLUMN / RENAME INDEX + additive
-- columns with defaults. No data is copied, nothing is dropped. Existing rows
-- default to product = 'academy'. API paths (/api/academies/**) are unchanged.
-- ============================================================================

-- ── Academy → Tenant ─────────────────────────────────────────────────────────
RENAME TABLE `Academy` TO `Tenant`;
ALTER TABLE `Tenant` RENAME INDEX `Academy_slug_key` TO `Tenant_slug_key`;
ALTER TABLE `Tenant` RENAME INDEX `Academy_customDomain_key` TO `Tenant_customDomain_key`;
ALTER TABLE `Tenant`
    ADD COLUMN `product`      VARCHAR(191) NOT NULL DEFAULT 'academy',
    -- Stores: the saas-store image tag this tenant runs (null = follow the platform tag).
    ADD COLUMN `imageTag`     VARCHAR(191) NULL,
    -- Last provisioning progress {job, kind, step, total, label, at} from the provisioner.
    ADD COLUMN `progressJson` JSON NULL,
    -- Why the last provisioning job failed (shown to the admin; cleared on retry).
    ADD COLUMN `lastError`    TEXT NULL,
    -- GitHub branch is an academy-only concept; stores have none.
    MODIFY COLUMN `branch`    VARCHAR(191) NULL;
CREATE INDEX `Tenant_product_status_idx` ON `Tenant`(`product`, `status`);

-- ── Payment / Subscription: academySlug → tenantSlug ─────────────────────────
ALTER TABLE `Payment`
    RENAME COLUMN `academySlug` TO `tenantSlug`,
    ADD COLUMN `product` VARCHAR(191) NOT NULL DEFAULT 'academy';
ALTER TABLE `Subscription` RENAME COLUMN `academySlug` TO `tenantSlug`;
ALTER TABLE `Subscription` RENAME INDEX `Subscription_academySlug_key` TO `Subscription_tenantSlug_key`;

-- ── AcademyRevenue → TenantRevenue, Settlement.academySlug → tenantSlug ──────
RENAME TABLE `AcademyRevenue` TO `TenantRevenue`;
ALTER TABLE `TenantRevenue`
    RENAME COLUMN `academySlug` TO `tenantSlug`,
    ADD COLUMN `product` VARCHAR(191) NOT NULL DEFAULT 'academy';
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_academySlug_orderId_key` TO `TenantRevenue_tenantSlug_orderId_key`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_academySlug_idx`  TO `TenantRevenue_tenantSlug_idx`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_paidAt_idx`       TO `TenantRevenue_paidAt_idx`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_provider_idx`     TO `TenantRevenue_provider_idx`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_status_idx`       TO `TenantRevenue_status_idx`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_settled_idx`      TO `TenantRevenue_settled_idx`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_mode_idx`         TO `TenantRevenue_mode_idx`;
ALTER TABLE `TenantRevenue` RENAME INDEX `AcademyRevenue_settlementId_idx` TO `TenantRevenue_settlementId_idx`;

ALTER TABLE `Settlement` RENAME COLUMN `academySlug` TO `tenantSlug`;
ALTER TABLE `Settlement` RENAME INDEX `Settlement_academySlug_idx` TO `Settlement_tenantSlug_idx`;

-- ── License: which product a plan belongs to ─────────────────────────────────
ALTER TABLE `License` ADD COLUMN `product` VARCHAR(191) NOT NULL DEFAULT 'academy';
CREATE INDEX `License_product_active_idx` ON `License`(`product`, `active`);
