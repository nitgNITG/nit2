// Orphan check: what is still on the academy (server B) and store hosts with no
// tenant in nit2 — left behind by deletes from before the teardown fix, a failed
// teardown, or a hand-made test. READ-ONLY: it changes nothing anywhere, it only
// prints what it found and the command that would clean each piece up.
//
//   node scripts/orphan-check.mjs                     readable report (exit 1 when anything needs attention)
//   node scripts/orphan-check.mjs --json              machine-readable
//   node scripts/orphan-check.mjs --ignore a.com,b    skip these host names / slugs (your own non-tenant sites)
//
// Run where nit2's .env is (the nit2 server): it needs PROVISION_URL / PROVISION_SECRET,
// STORE_PROVISION_URL / STORE_PROVISION_SECRET (GET /inventory on each host) and the
// MySQL tenant table (MYSQL_DATABASE_URL). Either host may be missing — it is reported and skipped.
import { pathToFileURL } from 'node:url'
import { loadEnv, parseArgs } from './promo-common.mjs'

const ACADEMY_PORT_MIN = 8100 // create.sh PORT_BASE
const PROVISIONER_PORTS = new Set([9098, 9099]) // the provisioners' own vhosts
const RANK = { high: 0, medium: 1, low: 2, info: 3 }

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Fix commands, run on the host that holds the piece. */
const destroyCmd = (product, slug) => product === 'store'
    ? `sudo bash /var/www/html/saas-stores/destroy-store.sh ${slug}`
    : `sudo bash /root/destroy.sh ${slug}`
const vhostCmd = (file, names) => {
    const nginx = file.includes('/nginx/')
    // Apache keeps <name>.conf + <name>-le-ssl.conf (certbot's copy): remove both, whichever was found.
    const stem = file.replace(/(-le-ssl)?\.conf$/, '')
    const base = stem.split('/').pop()
    const drop = nginx ? `sudo rm ${file} && sudo nginx -t && sudo systemctl reload nginx`
        : `sudo a2dissite ${base}.conf ${base}-le-ssl.conf; sudo rm -f ${stem}.conf ${stem}-le-ssl.conf; sudo apache2ctl configtest && sudo systemctl reload apache2`
    return `${drop}${names.length ? `; ${names.map((n) => `sudo certbot delete --cert-name ${n}`).join('; ')}` : ''}`
}

const tenantRangePort = (p) => p >= ACADEMY_PORT_MIN && !PROVISIONER_PORTS.has(p)
const portOwners = (inventories) => {
    const owner = new Map() // port → { product, slug }
    for (const [product, inv] of Object.entries(inventories)) {
        if (!inv) continue
        for (const [slug, ports] of Object.entries(inv.ports ?? {})) for (const p of ports) owner.set(p, { product, slug })
    }
    return owner
}
const uniqueVhosts = (inventories) => {
    const seen = new Set()
    return Object.values(inventories).filter(Boolean).flatMap((inv) => inv.vhosts ?? [])
        .filter((v) => !seen.has(v.file) && seen.add(v.file)) // a shared host is scanned by both provisioners
}
/** A vhost no tenant owns but that proxies into the tenant port range: a leftover OR one of your own sites. */
const unownedTenantRange = (v, owner) => v.ports.some(tenantRangePort) && !v.ports.some((p) => owner.has(p))

/**
 * Host names to probe over public HTTPS before analyze(): the vhosts no tenant owns.
 * The inventory cannot tell a leftover from one of your own sites on a tenant-range
 * port (a meeting server, a hand-made Moodle…) — what the name serves can.
 */
export function namesToProbe(inventories) {
    const owner = portOwners(inventories)
    return [...new Set(uniqueVhosts(inventories).filter((v) => unownedTenantRange(v, owner)).flatMap((v) => v.names))]
}

/** 502/503/504 = the proxy has nothing behind it. 0 / missing = could not tell. */
const DEAD = new Set([502, 503, 504])

/**
 * Compare host inventories with the tenant rows.
 * tenants: [{ slug, product, status, customDomain, lastError? }]
 * inventories: { academy?: inv, store?: inv } — the JSON of GET /inventory
 * probes: { "<host name>": HTTP status of https://<name>/ (0 = unreachable) } for namesToProbe()
 * Returns findings sorted by severity: { severity, kind, product?, slug?, text, fix? }.
 */
export function analyze({ tenants, inventories, ignore = [], probes = {} }) {
    const ignored = new Set(ignore.map((s) => s.toLowerCase()))
    const findings = []
    const rows = new Map(tenants.map((t) => [`${t.product}:${t.slug}`, t]))
    const owner = portOwners(inventories)
    const domains = {}
    for (const [product, inv] of Object.entries(inventories)) {
        if (!inv) continue
        domains[product] = inv.domain
        for (const e of inv.errors ?? []) findings.push({ severity: 'info', kind: 'partial', product, text: `${product} host: ${e} — that part was not checked` })
    }
    const vhosts = uniqueVhosts(inventories)

    // 1) Per slug: what each product keeps on its host for a tenant.
    for (const [product, inv] of Object.entries(inventories)) {
        if (!inv) continue
        const pieces = new Map() // slug → { container, dir, database, media, vhost }
        const add = (slug, what, val = true) => {
            if (ignored.has(slug)) return
            if (!pieces.has(slug)) pieces.set(slug, {})
            pieces.get(slug)[what] = val
        }
        for (const c of inv.containers ?? []) add(c.slug, 'container', c.state || 'present')
        for (const d of inv.dirs ?? []) add(d, 'dir')
        for (const d of inv.databases ?? []) add(d, 'database')
        for (const d of inv.media ?? []) add(d, 'media')
        // A vhost belongs to a slug when that slug's container owns its port.
        for (const v of vhosts) {
            const o = v.ports.map((p) => owner.get(p)).find(Boolean)
            if (o?.product === product) add(o.slug, 'vhost')
        }

        for (const [slug, p] of pieces) {
            const row = rows.get(`${product}:${slug}`)
            const list = [
                p.container && `container (${p.container})`, p.database && 'database', p.dir && 'files',
                p.media && 'Cloudinary media', p.vhost && 'vhost',
            ].filter(Boolean).join(', ')
            if (!row) {
                findings.push({
                    severity: p.container === 'running' ? 'high' : 'medium',
                    kind: 'orphan', product, slug,
                    text: `${product} "${slug}" has no tenant in nit2 but still has: ${list}`,
                    fix: destroyCmd(product, slug),
                })
            } else if (row.status === 'deleting') {
                findings.push({
                    severity: 'medium', kind: 'teardown-pending', product, slug,
                    text: `${product} "${slug}" is being deleted and still has: ${list}${row.lastError ? ` — last error: ${row.lastError}` : ''}`,
                    fix: 'the daily cron retries it; fix the cause, or run: ' + destroyCmd(product, slug),
                })
            }
        }
        // 2) The other way round: a tenant that should be running but is not on its host.
        for (const t of tenants) {
            if (t.product !== product || !['live', 'suspended'].includes(t.status) || ignored.has(t.slug)) continue
            const p = pieces.get(t.slug)
            if (!p?.container) {
                findings.push({
                    severity: 'medium', kind: 'missing', product, slug: t.slug,
                    text: `${product} "${t.slug}" is ${t.status} in nit2 but has no container on its host${p ? ` (still has: ${Object.keys(p).join(', ')})` : ''}`,
                })
            }
        }
    }

    // 3) Vhosts: does each host name serve the tenant it should?
    for (const v of vhosts) {
        const names = v.names.filter((n) => !ignored.has(n))
        if (!names.length) continue
        const o = v.ports.map((p) => owner.get(p)).find(Boolean)
        if (o) {
            // Owned: every name must be that tenant's own subdomain or its current custom domain.
            const row = rows.get(`${o.product}:${o.slug}`)
            const own = new Set([`${o.slug}.${domains[o.product]}`, (row?.customDomain ?? '').toLowerCase()].filter(Boolean))
            for (const name of names.filter((n) => !own.has(n))) {
                findings.push({
                    severity: 'high', kind: 'stale-domain', product: o.product, slug: o.slug,
                    text: row
                        ? `${name} (${v.file}) serves ${o.product} "${o.slug}", whose domain in nit2 is ${row.customDomain || 'none'} — visitors of ${name} land on someone else's site`
                        : `${name} (${v.file}) serves ${o.product} "${o.slug}", which has no tenant in nit2`,
                    fix: vhostCmd(v.file, [name]),
                })
            }
            continue
        }
        if (!unownedTenantRange(v, owner)) continue // proxies to something that is not a tenant (nit2, a provisioner…)
        const ports = v.ports.filter(tenantRangePort).join(',')
        const statuses = names.map((n) => probes[n])
        if (statuses.some((st) => DEAD.has(st))) {
            findings.push({
                severity: 'high', kind: 'dangling-vhost',
                text: `${names.join(', ')} (${v.file}) proxies to 127.0.0.1:${ports}, where nothing runs now (it answers ${statuses.find((st) => DEAD.has(st))}) — the next new academy or store that gets that port would be served under this domain`,
                fix: vhostCmd(v.file, names),
            })
        } else if (statuses.every((st) => !st)) {
            findings.push({
                severity: 'low', kind: 'unchecked-vhost',
                text: `${names.join(', ')} (${v.file}) proxies to 127.0.0.1:${ports}, which is no tenant's — it could not be reached to tell a leftover from one of your own sites; check it by hand`,
            })
        } // else: it serves something — one of your own sites on that port, left alone.
    }

    // <name>.conf and certbot's <name>-le-ssl.conf are one site: one finding, one fix.
    const seen = new Set()
    return findings
        .filter((f) => !f.fix || (!seen.has(`${f.kind}|${f.fix}`) && seen.add(`${f.kind}|${f.fix}`)))
        .sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.slug ?? '').localeCompare(b.slug ?? ''))
}

/** checked: the products whose host answered — the report never claims more than that. */
export function formatReport(findings, { hosts, checked = [] }) {
    const lines = [`Orphan check — ${new Date().toISOString()}`, `hosts: ${hosts}`, '']
    if (!checked.length) return [...lines, '✖ no host could be checked — nothing was compared (see "hosts" above).'].join('\n')
    if (!findings.length) {
        const scope = checked.length === 2 ? 'both hosts' : `the ${checked[0]} host (the other one was NOT checked)`
        return [...lines, `✔ nothing left behind on ${scope}: every container, database, file, vhost and media folder belongs to a tenant.`].join('\n')
    }
    for (const sev of ['high', 'medium', 'low', 'info']) {
        const group = findings.filter((f) => f.severity === sev)
        if (!group.length) continue
        lines.push(`${sev.toUpperCase()} (${group.length})`)
        for (const f of group) {
            lines.push(`  • ${f.text}`)
            if (f.fix) lines.push(`      fix: ${f.fix}`)
        }
        lines.push('')
    }
    lines.push('Nothing was changed. Run a fix on the host that holds the piece (destroy*.sh are safe to re-run).')
    return lines.join('\n')
}

/** HTTP status of https://<name>/ (no redirects followed); 0 when it cannot be reached. Read-only. */
async function probe(name) {
    try {
        const r = await fetch(`https://${name}/`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
        return r.status
    } catch {
        return 0
    }
}

async function inventory(base, secret, label) {
    if (!base || !secret) return { inv: null, note: `${label}: not configured` }
    try {
        const url = new URL(base)
        url.pathname = (label === 'academy' ? '' : url.pathname.replace(/\/$/, '')) + '/inventory'
        url.search = ''
        const res = await fetch(url, { headers: { 'X-Provision-Secret': secret }, signal: AbortSignal.timeout(120_000) })
        if (res.status === 404) return { inv: null, note: `${label}: host has no /inventory yet — deploy its provisioning folder` }
        if (!res.ok) return { inv: null, note: `${label}: HTTP ${res.status}` }
        return { inv: await res.json(), note: `${label}: ok` }
    } catch (e) {
        return { inv: null, note: `${label}: unreachable (${e.message})` }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2), ['json'])
    loadEnv()
    const [academy, store] = await Promise.all([
        inventory(process.env.PROVISION_URL, process.env.PROVISION_SECRET, 'academy'),
        inventory(process.env.STORE_PROVISION_URL, process.env.STORE_PROVISION_SECRET, 'store'),
    ])
    const { PrismaClient } = await import('prismamysql')
    const mysql = new PrismaClient()
    let tenants
    try {
        tenants = await mysql.tenant.findMany({ select: { slug: true, product: true, status: true, customDomain: true, lastError: true } })
    } finally {
        await mysql.$disconnect()
    }
    const inventories = { academy: academy.inv, store: store.inv }
    const probes = Object.fromEntries(await Promise.all(namesToProbe(inventories).map(async (name) => [name, await probe(name)])))
    const findings = analyze({
        tenants, inventories, probes,
        ignore: String(args.ignore ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    })
    const hosts = `${academy.note} · ${store.note}`
    const checked = [academy.inv && 'academy', store.inv && 'store'].filter(Boolean)
    console.log(args.json ? JSON.stringify({ hosts, checked, findings }, null, 2) : formatReport(findings, { hosts, checked }))
    if (!academy.inv && !store.inv) process.exit(2)
    process.exit(findings.some((f) => f.severity === 'high' || f.severity === 'medium') ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => { console.error(`✖ ${e.message ?? e}`); process.exit(2) })
}
