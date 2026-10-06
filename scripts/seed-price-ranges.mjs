// Seed the AI assistant's custom-project price ranges (CustomPriceRange, Mongo)
// from scripts/data/price-ranges.json.
//
//   node scripts/seed-price-ranges.mjs              insert missing categories, INACTIVE
//   node scripts/seed-price-ranges.mjs --activate   insert them active (the assistant quotes them)
//   node scripts/seed-price-ranges.mjs --force      also overwrite existing ones (sales edits are lost!)
//   node scripts/seed-price-ranges.mjs --dry-run    print the plan, write nothing
//
// The assistant quotes ACTIVE ranges word for word to customers, and only the sales
// team sets prices (SRS FR-S12, D9) — so by default this never activates anything
// and never touches a range that already exists.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const CATEGORY = /^[a-z0-9_]{1,60}$/

/** Validate one seed row (same rules as the dashboard's PriceRangeSchema). Returns an error or null. */
export function validateSeed(r) {
    if (!r || typeof r !== 'object') return 'not an object'
    if (!CATEGORY.test(r.category ?? '')) return `bad category "${r.category}"`
    for (const k of ['labelAr', 'labelEn']) if (typeof r[k] !== 'string' || !r[k].trim() || r[k].length > 120) return `${r.category}: ${k} is required (≤ 120 chars)`
    if (!Number.isInteger(r.minUsd) || r.minUsd < 0) return `${r.category}: minUsd must be a whole number ≥ 0`
    if (r.maxUsd != null && (!Number.isInteger(r.maxUsd) || r.maxUsd < r.minUsd)) return `${r.category}: maxUsd must be ≥ minUsd (or null for "from")`
    for (const k of ['notesAr', 'notesEn']) if (r[k] != null && (typeof r[k] !== 'string' || r[k].length > 500)) return `${r.category}: ${k} must be ≤ 500 chars`
    return null
}

/**
 * What to do for each seed row given the categories already stored.
 * existing: Map<category, row>. Returns [{ action: 'create'|'update'|'skip', category, data }].
 */
export function planSeed(seeds, existing, { activate = false, force = false } = {}) {
    return seeds.map((r) => {
        const data = {
            category: r.category, labelAr: r.labelAr.trim(), labelEn: r.labelEn.trim(),
            minUsd: r.minUsd, maxUsd: r.maxUsd ?? null,
            notesAr: r.notesAr?.trim() || null, notesEn: r.notesEn?.trim() || null,
            active: activate,
        }
        const current = existing.get(r.category)
        if (!current) return { action: 'create', category: r.category, data }
        if (!force) return { action: 'skip', category: r.category, data }
        return { action: 'update', category: r.category, data }
    })
}

export function loadSeeds(file) {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    const ranges = json.ranges ?? []
    const errors = ranges.map(validateSeed).filter(Boolean)
    const dupes = ranges.map((r) => r.category).filter((c, i, a) => a.indexOf(c) !== i)
    if (dupes.length) errors.push(`duplicate categories: ${dupes.join(', ')}`)
    if (errors.length) throw new Error(`Invalid price-range seeds:\n- ${errors.join('\n- ')}`)
    return ranges
}

async function main() {
    const args = new Set(process.argv.slice(2))
    const opts = { activate: args.has('--activate'), force: args.has('--force'), dryRun: args.has('--dry-run') }
    const here = path.dirname(fileURLToPath(import.meta.url))
    const seeds = loadSeeds(path.join(here, 'data', 'price-ranges.json'))

    const { PrismaClient } = await import('@prisma/client')
    const mongo = new PrismaClient()
    try {
        const rows = await mongo.customPriceRange.findMany()
        const plan = planSeed(seeds, new Map(rows.map((r) => [r.category, r])), opts)
        let changed = 0
        for (const step of plan) {
            const range = `${step.data.minUsd}${step.data.maxUsd == null ? '+' : `–${step.data.maxUsd}`} USD`
            console.log(`${step.action.padEnd(6)} ${step.category.padEnd(18)} ${range}${step.action === 'skip' ? ' (exists — sales edits kept; --force to overwrite)' : step.data.active ? ' [ACTIVE]' : ' [inactive]'}`)
            if (opts.dryRun || step.action === 'skip') continue
            if (step.action === 'create') {
                await mongo.customPriceRange.create({ data: { ...step.data, version: 1, updatedBy: 'seed' } })
            } else {
                await mongo.customPriceRange.update({ where: { category: step.category }, data: { ...step.data, version: { increment: 1 }, updatedBy: 'seed' } })
            }
            changed++
        }
        if (changed && !opts.dryRun) {
            // The assistant's cached knowledge includes a version number; bump it so the next turn sees the change.
            const { PrismaClient: MysqlClient } = await import('prismamysql')
            const mysql = new MysqlClient()
            try {
                const KEY = 'ai_agent_knowledge_version'
                const row = await mysql.platformSetting.findUnique({ where: { key: KEY } })
                const next = String((parseInt(row?.value ?? '0', 10) || 0) + 1)
                await mysql.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } })
            } finally {
                await mysql.$disconnect()
            }
        }
        console.log(`\n${opts.dryRun ? 'Dry run — nothing written.' : `${changed} range(s) written.`}${opts.activate ? '' : ' Seeded ranges are INACTIVE: review them in Dashboard → Price Ranges and tick Active.'}`)
    } finally {
        await mongo.$disconnect()
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => { console.error(e.message ?? e); process.exit(1) })
}
