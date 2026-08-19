// One-off: copy the production Academy records from MongoDB → the MySQL control plane.
//
// The Academy model was removed from the Mongo schema (academies live in MySQL now),
// so we read the raw `Academy` collection via $runCommandRaw rather than the client.
//
// NON-DESTRUCTIVE: it only reads Mongo and UPSERTS into MySQL by slug. It never drops
// or edits the Mongo side. Idempotent — safe to re-run.
//
// Usage (from a host that can reach BOTH databases):
//   MONGO_PROD_URL="mongodb+srv://…" node scripts/migrate-academies-to-mysql.mjs
//   (MySQL target comes from MYSQL_DATABASE_URL in .env)
//
//   Add --commit to actually write; without it, it's a DRY RUN that only reports.

import { PrismaClient as MongoClient } from '@prisma/client'
import { PrismaClient as MysqlClient } from 'prismamysql'

const MONGO_URL = process.env.MONGO_PROD_URL
const COMMIT = process.argv.includes('--commit')
const TIERS = ['demo', 'basic', 'standard', 'professional']

if (!MONGO_URL) {
    console.error('Set MONGO_PROD_URL to the production Mongo connection string.')
    process.exit(1)
}

const mongo = new MongoClient({ datasources: { db: { url: MONGO_URL } } })
const mysql = new MysqlClient()

const oid = (v) => (v && typeof v === 'object' && v.$oid ? v.$oid : v == null ? null : String(v))
const when = (v) => {
    if (!v) return undefined
    if (typeof v === 'object' && v.$date) return new Date(v.$date)
    const d = new Date(v)
    return isNaN(d.getTime()) ? undefined : d
}

try {
    const res = await mongo.$runCommandRaw({ find: 'Academy', batchSize: 1000 })
    const docs = res?.cursor?.firstBatch ?? []
    console.log(`Mongo: found ${docs.length} academies.`)
    console.log(COMMIT ? '── COMMIT mode ──' : '── DRY RUN (pass --commit to write) ──')

    let created = 0, updated = 0, skipped = 0
    for (const d of docs) {
        if (!d.slug) { skipped++; console.log('  skip (no slug):', d._id); continue }
        const data = {
            name: String(d.name ?? d.slug),
            slug: String(d.slug),
            branch: String(d.branch ?? `client/${d.slug}`),
            status: String(d.status ?? 'branch_created'),
            tier: TIERS.includes(String(d.tier)) ? String(d.tier) : 'demo',
            ownerId: oid(d.ownerId),
            ...(when(d.createdAt) ? { createdAt: when(d.createdAt) } : {}),
        }
        const existing = await mysql.academy.findUnique({ where: { slug: data.slug } })
        if (!COMMIT) { console.log(`  ${existing ? 'update' : 'create'}: ${data.slug} (${data.status}, ${data.tier})`); existing ? updated++ : created++; continue }
        if (existing) { await mysql.academy.update({ where: { slug: data.slug }, data }); updated++ }
        else { await mysql.academy.create({ data }); created++ }
    }
    console.log(`Done. created=${created} updated=${updated} skipped=${skipped}`)
    console.log('MySQL Academy total now:', await mysql.academy.count())
} catch (e) {
    console.error('FAILED:', String(e.message).slice(0, 300))
    process.exit(1)
} finally {
    await mongo.$disconnect()
    await mysql.$disconnect()
}
