// Apply scripts/data/promos.json to the live projects: promo video, which service
// pages show the project ("Built by N.I.T"), Featured position, category label,
// feature chips and key results.
//
//   node scripts/promo-apply.mjs --dry-run                 show what would change
//   node scripts/promo-apply.mjs                           apply every entry
//   node scripts/promo-apply.mjs --only "Tawreedat Go"     apply one project
//        [--file other.json] [--site https://www.nitg-eg.com] [--admin-email you@x.com]
//
// It goes through the site's own admin API (PUT /api/project/:id), so the server
// validates everything (videos must be in our Cloudinary account), deletes a
// replaced promo video and refreshes the cached pages at once — exactly like
// saving the project in the dashboard. Only the keys present in an entry change;
// `"promo": null` removes a promo.
//
// A project that doesn't exist yet is created when its entry has a "create" block
// ({ title, titleEn, description, descriptionEn, types, links, image }); "image" is a
// file path, a URL, or "poster" = a frame of the entry's promo video.
//
// Run where .env has SECRET_JWT and MYSQL_DATABASE_URL (the server): the script
// signs a short-lived admin token for the first admin user (or --admin-email).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PROMOS_FILE, ROOT, SERVICE_SLUGS, loadEnv, parseArgs, readPromos, sameProject } from './promo-common.mjs'

const KEYS = ['match', 'promo', 'services', 'featuredOrder', 'categoryEn', 'categoryAr', 'features', 'keyResults', 'note', 'create']
const CREATE_TEXT = ['title', 'titleEn', 'description', 'descriptionEn']

/** Problems in one promos.json entry (the server re-validates; this catches typos early). */
export function validateEntry(e) {
    const errs = []
    if (!e || typeof e !== 'object') return ['entry is not an object']
    const name = e.match || '(no match)'
    if (typeof e.match !== 'string' || !e.match.trim()) errs.push('"match" (the project\'s English title or id) is required')
    for (const k of Object.keys(e)) if (!KEYS.includes(k)) errs.push(`${name}: unknown key "${k}"`)
    if ('services' in e) {
        if (!Array.isArray(e.services)) errs.push(`${name}: services must be a list`)
        else for (const s of e.services) if (!SERVICE_SLUGS.includes(s)) errs.push(`${name}: unknown service "${s}" (one of: ${SERVICE_SLUGS.join(', ')})`)
    }
    if ('featuredOrder' in e && e.featuredOrder !== null && ![1, 2, 3].includes(e.featuredOrder)) errs.push(`${name}: featuredOrder must be 1, 2, 3 or null`)
    if ('promo' in e && e.promo !== null && (typeof e.promo?.videoUrl !== 'string' || !e.promo.videoUrl.startsWith('https://res.cloudinary.com/'))) {
        errs.push(`${name}: promo.videoUrl must be a Cloudinary URL (upload with scripts/promo-upload-video.mjs)`)
    }
    if ('features' in e && (!Array.isArray(e.features) || e.features.length > 3)) errs.push(`${name}: features must be a list of at most 3 { en, ar }`)
    if ('keyResults' in e && !Array.isArray(e.keyResults)) errs.push(`${name}: keyResults must be a list of { value, labelEn, labelAr }`)
    if ('create' in e) {
        const c = e.create
        if (!c || typeof c !== 'object') errs.push(`${name}: create must be an object`)
        else {
            for (const k of CREATE_TEXT) if (typeof c[k] !== 'string' || !c[k].trim()) errs.push(`${name}: create.${k} is required`)
            if (typeof c.image !== 'string' || !c.image) errs.push(`${name}: create.image is required (file path, URL or "poster")`)
            if (c.image === 'poster' && !e.promo?.videoUrl) errs.push(`${name}: create.image "poster" needs a promo video on the entry (run promo-upload-video.mjs first)`)
            if (c.types != null && (!Array.isArray(c.types) || !c.types.length)) errs.push(`${name}: create.types must be a non-empty list`)
            if (c.links != null && !Array.isArray(c.links)) errs.push(`${name}: create.links must be a list of { headerEn, headerAr, link }`)
        }
    }
    return errs
}

/** The multipart fields PUT /api/project/:id expects. `important` is resent because the route resets it when missing. */
export function toFormFields(entry, current) {
    const f = { important: String(!!current.important) }
    if ('promo' in entry) f.promo = entry.promo ? JSON.stringify(entry.promo) : ''
    if ('featuredOrder' in entry) f.featuredOrder = entry.featuredOrder == null ? '' : String(entry.featuredOrder)
    if ('services' in entry) f.services = JSON.stringify(entry.services)
    if ('categoryEn' in entry) f.categoryEn = entry.categoryEn ?? ''
    if ('categoryAr' in entry) f.categoryAr = entry.categoryAr ?? ''
    if ('features' in entry) f.features = JSON.stringify(entry.features)
    if ('keyResults' in entry) f.keyResults = JSON.stringify(entry.keyResults)
    return f
}

/** A still frame of a promo video (Cloudinary transform), used as a new project's card image. */
export function posterUrl(promo) {
    const at = promo.posterAt ?? (promo.teaserStart ?? 0) + 1
    return promo.videoUrl
        .replace('/video/upload/', `/video/upload/so_${at},w_1280,h_720,c_limit,q_auto/`)
        .replace(/\.[a-z0-9]+$/i, '.jpg')
}

/** Multipart fields for POST /api/project (everything except the image). */
export function toCreateFields(entry) {
    const c = entry.create
    return {
        ...toFormFields(entry, { important: false }),
        title: c.title.trim(), titleEn: c.titleEn.trim(), description: c.description.trim(), descriptionEn: c.descriptionEn.trim(),
        types: JSON.stringify(c.types ?? ['ecommerce']),
        links: JSON.stringify(c.links ?? []),
    }
}

/**
 * Match entries to projects. Returns { steps: [{ action: 'update'|'create', entry, project, fields }],
 * missing: [match], warnings: [] }. A missing project with a "create" block becomes a create step.
 */
export function planApply(entries, projects, { only } = {}) {
    const chosen = only ? entries.filter((e) => sameProject(e.match, only)) : entries
    const steps = []
    const missing = []
    for (const entry of chosen) {
        const project = projects.find((p) => sameProject(p.titleEn, entry.match) || sameProject(p.title, entry.match) || p.id === entry.match)
        if (project) steps.push({ action: 'update', entry, project, fields: toFormFields(entry, project) })
        else if (entry.create) steps.push({ action: 'create', entry, project: { titleEn: entry.create.titleEn, promo: null }, fields: toCreateFields(entry) })
        else missing.push(entry.match)
    }
    const warnings = []
    const featured = new Map()
    for (const { entry, project } of steps) {
        if (entry.featuredOrder == null) continue
        if (featured.has(entry.featuredOrder)) warnings.push(`featuredOrder ${entry.featuredOrder} is used by both "${featured.get(entry.featuredOrder)}" and "${project.titleEn}"`)
        featured.set(entry.featuredOrder, project.titleEn)
        const hasPromo = 'promo' in entry ? !!entry.promo : !!project.promo?.videoUrl
        if (!hasPromo) warnings.push(`"${project.titleEn}" is featured but has no promo video — it won't show in the band until it has one`)
    }
    return { steps, missing, warnings }
}

async function adminToken(email) {
    const secret = process.env.SECRET_JWT
    if (!secret) throw new Error('SECRET_JWT is not set (.env)')
    const { PrismaClient } = await import('prismamysql')
    const mysql = new PrismaClient()
    try {
        const user = email
            ? await mysql.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } })
            : await mysql.user.findFirst({ where: { role: 'admin' }, select: { id: true, email: true, role: true }, orderBy: { createdAt: 'asc' } })
        if (!user || (user.role !== 'admin' && user.role != null)) throw new Error(email ? `${email} is not an admin` : 'No admin user found')
        const { default: jwt } = await import('jsonwebtoken')
        return { token: jwt.sign({ id: user.id }, secret, { expiresIn: '10m' }), email: user.email }
    } finally {
        await mysql.$disconnect()
    }
}

/** The card image for a new project: a local file, a URL, or the promo's poster frame. */
async function loadImage(entry) {
    const src = entry.create.image === 'poster' ? posterUrl(entry.promo) : entry.create.image
    if (/^https?:\/\//.test(src)) {
        const r = await fetch(src)
        if (!r.ok) throw new Error(`Could not download the image for "${entry.match}": ${src} → ${r.status}`)
        return new Blob([await r.arrayBuffer()], { type: r.headers.get('content-type') || 'image/jpeg' })
    }
    const file = path.isAbsolute(src) ? src : path.join(ROOT, src)
    return new Blob([readFileSync(file)], { type: /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg' })
}

const HIDDEN = ['important', 'title', 'description', 'descriptionEn', 'links']
const describe = (f) => Object.entries(f).filter(([k]) => !HIDDEN.includes(k)).map(([k, v]) => {
    if (k === 'promo') return v ? `promo=${JSON.parse(v).videoUrl.split('/').pop()}` : 'promo=REMOVE'
    return `${k}=${v.length > 60 ? v.slice(0, 57) + '…' : v}`
}).join('  ')

async function main() {
    const args = parseArgs(process.argv.slice(2), ['dry-run'])
    loadEnv()
    const site = (args.site || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nitg-eg.com').replace(/\/+$/, '')
    const file = args.file || PROMOS_FILE
    const { projects: entries } = readPromos(file)
    const errors = entries.flatMap(validateEntry)
    if (errors.length) throw new Error(`${file} has problems:\n- ${errors.join('\n- ')}`)
    if (!entries.length) throw new Error(`No entries in ${file}`)

    const res = await fetch(`${site}/api/project?type=all&dashboard=true`)
    if (!res.ok) throw new Error(`GET ${site}/api/project → ${res.status}`)
    const { data: projects } = await res.json()

    const { steps, missing, warnings } = planApply(entries, projects, { only: args.only })
    if (args.only && !steps.length && !missing.length) throw new Error(`No entry in ${file} matches "${args.only}"`)
    console.log(`${site} — ${steps.length} project(s) to update${args['dry-run'] ? ' (dry run)' : ''}\n`)
    for (const s of steps) {
        const isNew = s.action === 'create' ? ` (NEW project — card image: ${s.entry.create.image})` : ''
        console.log(`• ${s.project.titleEn}${isNew}\n    ${describe(s.fields) || '(nothing to change)'}`)
    }
    for (const m of missing) console.log(`! "${m}" — no such project. Create it in Dashboard → Projects first (or fix "match"). Skipped.`)
    for (const w of warnings) console.log(`⚠ ${w}`)
    if (args['dry-run'] || !steps.length) return

    const { token, email } = await adminToken(args['admin-email'])
    console.log(`\nApplying as ${email} …`)
    let failed = 0
    for (const s of steps) {
        const form = new FormData()
        for (const [k, v] of Object.entries(s.fields)) form.append(k, v)
        const create = s.action === 'create'
        if (create) form.append('img', await loadImage(s.entry), 'card.jpg')
        const r = await fetch(create ? `${site}/api/project` : `${site}/api/project/${s.project.id}`, {
            method: create ? 'POST' : 'PUT', body: form, headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (r.ok) console.log(`✔ ${s.project.titleEn}${create ? ' (created)' : ''}`)
        else { failed++; console.log(`✖ ${s.project.titleEn}: ${r.status} ${body.message ?? ''}`) }
    }
    if (failed) throw new Error(`${failed} project(s) failed`)
    console.log('\nDone — the service pages and Our Projects refresh immediately.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => { console.error(`✖ ${e.message ?? e}`); process.exit(1) })
}
