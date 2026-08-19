// Self-contained one-off: copy production Academy records from MongoDB -> MySQL.
//
// No Prisma, no app code — just the `mongodb` and `mysql2` drivers, so it runs on
// the prod server (which already reaches Atlas) without deploying the new code.
//
// Setup on the server (scratch dir, doesn't touch the app):
//   mkdir -p /tmp/acadmig && cd /tmp/acadmig
//   npm init -y >/dev/null && npm i mongodb mysql2
//   # copy this file here, then:
//   MONGO_PROD_URL="mongodb+srv://…" MYSQL_DATABASE_URL="mysql://user:pass@host:3306/nit2" \
//       node migrate-academies-standalone.mjs            # DRY RUN (reads only, writes nothing)
//   # when the dry run looks right, add --commit:
//   … node migrate-academies-standalone.mjs --commit
//
// Idempotent: upserts by slug (INSERT … ON DUPLICATE KEY UPDATE). Safe to re-run.
// The MySQL `Academy` table must already exist (it does — created by the migration).

import { MongoClient } from 'mongodb'
import mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'

const MONGO_URL = process.env.MONGO_PROD_URL
const MYSQL_URL = process.env.MYSQL_DATABASE_URL
const COMMIT = process.argv.includes('--commit')
const TIERS = ['demo', 'basic', 'standard', 'professional']

if (!MONGO_URL || !MYSQL_URL) {
    console.error('Set both MONGO_PROD_URL and MYSQL_DATABASE_URL.')
    process.exit(1)
}

const mongo = new MongoClient(MONGO_URL)
let sql

try {
    await mongo.connect()
    const docs = await mongo.db().collection('Academy').find({}).toArray()
    console.log(`Mongo: found ${docs.length} academies.`)
    console.log(COMMIT ? '── COMMIT mode (writing to MySQL) ──' : '── DRY RUN (no writes — pass --commit) ──')

    sql = await mysql.createConnection(MYSQL_URL)

    let created = 0, updated = 0, skipped = 0
    for (const d of docs) {
        const slug = (d.slug ?? '').toString().trim()
        if (!slug) { skipped++; console.log('  skip (no slug):', d._id?.toString()); continue }

        const row = {
            name: (d.name ?? slug).toString(),
            slug,
            branch: (d.branch ?? `client/${slug}`).toString(),
            status: (d.status ?? 'branch_created').toString(),
            tier: TIERS.includes((d.tier ?? '').toString()) ? d.tier.toString() : 'demo',
            ownerId: d.ownerId != null ? d.ownerId.toString() : null,
            createdAt: d.createdAt instanceof Date ? d.createdAt : (d.createdAt ? new Date(d.createdAt) : new Date()),
        }

        const [existing] = await sql.query('SELECT id FROM Academy WHERE slug = ? LIMIT 1', [slug])
        const isUpdate = existing.length > 0

        if (!COMMIT) {
            console.log(`  ${isUpdate ? 'update' : 'create'}: ${slug}  (${row.status}, ${row.tier}${row.ownerId ? ', owner=' + row.ownerId : ''})`)
            isUpdate ? updated++ : created++
            continue
        }

        await sql.query(
            `INSERT INTO Academy (id, name, slug, branch, status, tier, ownerId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name=VALUES(name), branch=VALUES(branch), status=VALUES(status),
               tier=VALUES(tier), ownerId=VALUES(ownerId), createdAt=VALUES(createdAt)`,
            [randomUUID(), row.name, row.slug, row.branch, row.status, row.tier, row.ownerId, row.createdAt],
        )
        isUpdate ? updated++ : created++
    }

    console.log(`Done. created=${created} updated=${updated} skipped=${skipped}`)
    if (COMMIT) {
        const [rows] = await sql.query('SELECT COUNT(*) AS n FROM Academy')
        console.log('MySQL Academy total now:', rows[0].n)
    }
} catch (e) {
    console.error('FAILED:', String(e.message).slice(0, 300))
    process.exitCode = 1
} finally {
    await mongo.close().catch(() => {})
    if (sql) await sql.end().catch(() => {})
}
