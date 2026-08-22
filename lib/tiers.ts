// The local_license tiers — mirror of local_license::TIERS on the Moodle side.
// The build form lets the client pick one directly (not a ServicePlan); provisioning
// maps the chosen tier to local_license (tier + enabled) on the new academy.
export type TierKey = 'demo' | 'basic' | 'standard' | 'professional'

export type Tier = {
    key: TierKey
    nameEn: string
    nameAr: string
    priceEn: string
    priceAr: string
    featuresEn: string[]
    featuresAr: string[]
}

export const LICENSE_TIERS: Tier[] = [
    {
        key: 'demo',
        nameEn: 'Demo', nameAr: 'تجريبي',
        priceEn: 'Free', priceAr: 'مجاني',
        featuresEn: ['1 course', '1 teacher', '14 days'],
        featuresAr: ['كورس واحد', 'مدرّس واحد', '١٤ يوم'],
    },
    {
        key: 'basic',
        nameEn: 'Basic', nameAr: 'أساسي',
        priceEn: '$50', priceAr: '$50',
        featuresEn: ['3 courses', '1 teacher', 'YouTube video'],
        featuresAr: ['٣ كورسات', 'مدرّس واحد', 'فيديو YouTube'],
    },
    {
        key: 'standard',
        nameEn: 'Standard', nameAr: 'قياسي',
        priceEn: '$150', priceAr: '$150',
        featuresEn: ['10 courses', 'Unlimited teachers', 'Vimeo video'],
        featuresAr: ['١٠ كورسات', 'مدرّسين بلا حد', 'فيديو Vimeo'],
    },
    {
        key: 'professional',
        nameEn: 'Professional', nameAr: 'احترافي',
        priceEn: '$400', priceAr: '$400',
        featuresEn: ['Unlimited courses', 'DRM video', 'Payments, subscriptions, packages'],
        featuresAr: ['كورسات بلا حدود', 'فيديو محمي DRM', 'مدفوعات واشتراكات وباقات'],
    },
]
