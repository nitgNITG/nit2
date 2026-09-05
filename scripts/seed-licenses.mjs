// Seed the License table to mirror local_license::TIERS. Idempotent (upsert by key).
import { PrismaClient } from 'prismamysql'
const p = new PrismaClient()

const ALL_FEATURES = { drm: false, coupons: false, offers: false, subscriptions: false, packages: false, jitsi: false }

const LICENSES = [
    {
        key: 'demo', name: 'Demo', price: 0, durationDays: 14, maxCourses: 1, maxTeachers: 1,
        storageGb: 1, supportedApp: false, kashierEnabled: false, videoSource: 'limited', order: 0,
        limits: { quiz: 2, video: 4, pdf: 1, default: 1 }, features: { ...ALL_FEATURES },
    },
    {
        key: 'basic', name: 'Basic', price: 50, durationDays: 365, maxCourses: 3, maxTeachers: 1,
        storageGb: 5, supportedApp: true, kashierEnabled: true, videoSource: 'youtube', order: 1,
        limits: { quiz: -1, video: -1, pdf: -1, default: -1 }, features: { ...ALL_FEATURES },
    },
    {
        key: 'standard', name: 'Standard', price: 150, durationDays: 365, maxCourses: 10, maxTeachers: -1,
        storageGb: 20, supportedApp: true, kashierEnabled: true, videoSource: 'vimeo', order: 2,
        limits: { quiz: -1, video: -1, pdf: 10, default: -1 }, features: { ...ALL_FEATURES },
    },
    {
        key: 'professional', name: 'Professional', price: 400, durationDays: 365, maxCourses: -1, maxTeachers: -1,
        storageGb: 100, supportedApp: true, kashierEnabled: true, videoSource: 'vdocipher', order: 3,
        limits: { quiz: -1, video: -1, pdf: -1, default: -1 },
        features: { drm: true, coupons: true, offers: true, subscriptions: true, packages: true, jitsi: true },
    },
]

try {
    for (const l of LICENSES) {
        await p.license.upsert({ where: { key: l.key }, update: l, create: l })
        console.log('seeded', l.key)
    }
    console.log('total licenses:', await p.license.count())
} catch (e) {
    console.error('FAIL', String(e.message).slice(0, 200))
    process.exitCode = 1
} finally {
    await p.$disconnect()
}
