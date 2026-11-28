// Shared bits for scripts/promo-upload-video.mjs and scripts/promo-apply.mjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PROMOS_FILE = path.join(ROOT, 'scripts', 'data', 'promos.json')
export const PROMO_FOLDER = 'nit-promos' // keep in sync with lib/promoCloudinary.ts

// Keep in sync with PROMO_SERVICES in lib/promo.ts.
export const SERVICE_SLUGS = [
    'ecommerce-app', 'delivery-app', 'restaurant-app', 'loyalty-app', 'android-app', 'ios-app',
    'educational-platforms', 'ai-educational-platforms', 'moodle-lms', 'website-design', 'school-management',
]

/**
 * Load .env into process.env (without overriding what's already set). Same `\$`
 * rule as the app's dotenv-expand: a literal $ is written \$ (CLAUDE.md gotcha).
 */
export function loadEnv(file = path.join(ROOT, '.env')) {
    if (!existsSync(file)) return
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw)
        if (!m || m[1] in process.env) continue
        let v = m[2]
        if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1)
        else v = v.replace(/\s+#.*$/, '')
        process.env[m[1]] = v.replace(/\\\$/g, '$')
    }
}

/** --flag value / --flag=value / --bool; everything else is positional. */
export function parseArgs(argv, booleans = []) {
    const out = { _: [] }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (!a.startsWith('--')) { out._.push(a); continue }
        const [k, inline] = a.slice(2).split(/=(.*)/s)
        if (booleans.includes(k)) out[k] = true
        else out[k] = inline ?? argv[++i]
    }
    return out
}

export function readPromos(file = PROMOS_FILE) {
    if (!existsSync(file)) return { projects: [] }
    const json = JSON.parse(readFileSync(file, 'utf8'))
    return { ...json, projects: Array.isArray(json.projects) ? json.projects : [] }
}

export function writePromos(data, file = PROMOS_FILE) {
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

/** Case/space-insensitive project match on titleEn, title or id. */
export const sameProject = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
