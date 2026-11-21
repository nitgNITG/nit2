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
    const base = file.split('/').pop()
    const nginx = file.includes('/nginx/')
    const drop = nginx ? `sudo rm ${file} && sudo nginx -t && sudo systemctl reload nginx`
        : `sudo a2dissite ${base} ${base.replace(/\.conf$/, '-le-ssl.conf')}; sudo rm -f ${file} ${file.replace(/\.conf$/, '-le-ssl.conf')}; sudo apache2ctl configtest && sudo systemctl reload apache2`
    return `${drop}${names.length ? `; ${names.map((n) => `sudo certbot delete --cert-name ${n}`).join('; ')}` : ''}`
}

/**
 * Compare host inventories with the tenant rows.
 * tenants: [{ slug, product, status, customDomain }]
 * inventories: { academy?: inv, store?: inv } — the JSON of GET /inventory
 * Returns findings sorted by severity: { severity, kind, product?, slug?, text, fix? }.
 */
export function analyze({ tenants, inventories, ignore = [] }) {
    const ignored = new Set(ignore.map((s) => s.toLowerCase()))
    const findings = []
    const rows = new Map(tenants.map((t) => [`${t.product}:${t.slug}`, t]))
    const subdomainRe = {}
    const portOwner = new Map() // port → { product, slug }

    for (const [product, inv] of Object.entries(inventories)) {
        if (!inv) continue
        subdomainRe[product] = new RegExp(`^([a-z0-9-]+)\\.${escapeRe(inv.domain)}$`)
        for (const [slug, ports] of Object.entries(inv.ports ?? {})) for (const p of ports) portOwner.set(p, { product, slug })
        for (const e of inv.errors ?? []) findings.push({ severity: 'info', kind: 'partial', product, text: `${product} host: ${e} — that part was not checked` })
    }
    // Host names whose vhosts proxy only to non-tenant ports (a provisioner's own site,
    // nit2…): never a tenant, and neither is their certificate.
    const tenantPort = (p) => p >= ACADEMY_PORT_MIN && !PROVISIONER_PORTS.has(p)
    const infraNames = new Set(Object.values(inventories).filter(Boolean).flatMap((inv) => inv.vhosts ?? [])
        .filter((v) => !v.ports.some(tenantPort)).flatMap((v) => v.names))
    const subdomainOf = (name) => {
        for (const [product, re] of Object.entries(subdomainRe)) {
            const m = re.exec(name)
            if (m) return { product, slug: m[1] }
        }
        return null
    }

    // 1) Per slug: everything a product keeps on its host.
    for (const [product, inv] of Object.entries(inventories)) {
        if (!inv) continue
        const pieces = new Map() // slug → { container, dir, database, media, vhost, cert }
        const add = (slug, what, val = true) => {
            if (ignored.has(slug)) return
            if (!pieces.has(slug)) pieces.set(slug, {})
            pieces.get(slug)[what] = val
        }
        for (const c of inv.containers ?? []) add(c.slug, 'container', c.state || 'present')
        for (const d of inv.dirs ?? []) add(d, 'dir')
        for (const d of inv.databases ?? []) add(d, 'database')
        for (const d of inv.media ?? []) add(d, 'media')
        for (const v of inv.vhosts ?? []) for (const n of v.names) {
            if (infraNames.has(n)) continue
            const s = subdomainOf(n)
            if (s?.product === product) add(s.slug, 'vhost')
        }
        for (const c of inv.certs ?? []) {
            if (infraNames.has(c)) continue
            const s = subdomainOf(c)
            if (s?.product === product) add(s.slug, 'cert')
        }

        for (const [slug, p] of pieces) {
            const row = rows.get(`${product}:${slug}`)
            const list = [
                p.container && `container (${p.container})`, p.database && 'database', p.dir && 'files',
                p.media && 'Cloudinary media', p.vhost && 'vhost', p.cert && 'certificate',
            ].filter(Boolean).join(', ')
            if (!row) {
                const substantial = p.container || p.database || p.dir || p.media
                findings.push({
                    severity: p.container === 'running' ? 'high' : substantial ? 'medium' : 'low',
                    kind: 'orphan', product, slug,
                    text: `${product} "${slug}" has no tenant in nit2 but still has: ${list}`
                        + (substantial ? '' : ' (if this is one of your own sites, pass --ignore)'),
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

    // 3) Custom-domain vhosts (any host): who does each one actually serve?
    const seenFiles = new Set()
    const allVhosts = Object.values(inventories).filter(Boolean).flatMap((inv) => inv.vhosts ?? [])
    const vhostNames = new Set(allVhosts.flatMap((v) => v.names))
    for (const v of allVhosts) {
        if (seenFiles.has(v.file)) continue // the same host scanned by both provisioners
        seenFiles.add(v.file)
        const custom = v.names.filter((n) => !subdomainOf(n) && !ignored.has(n))
        if (!custom.length) continue
        const tenantPorts = v.ports.filter(tenantPort)
        if (!tenantPorts.length) continue // proxies to something that is not a tenant (nit2 itself, a provisioner…)
        const owners = tenantPorts.map((p) => portOwner.get(p)).filter(Boolean)
        if (!owners.length) {
            findings.push({
                severity: 'high', kind: 'dangling-vhost',
                text: `${custom.join(', ')} (${v.file}) proxies to 127.0.0.1:${tenantPorts.join(',')}, which no academy or store uses now — the next new one may get that port and be served under this domain`,
                fix: vhostCmd(v.file, custom),
            })
            continue
        }
        const { product, slug } = owners[0]
        const row = rows.get(`${product}:${slug}`)
        for (const name of custom) {
            if (row && (row.customDomain ?? '').toLowerCase() === name) continue
            findings.push({
                severity: 'high', kind: 'stale-domain', product, slug,
                text: row
                    ? `${name} (${v.file}) still serves ${product} "${slug}", whose domain in nit2 is ${row.customDomain || 'none'}`
                    : `${name} (${v.file}) serves ${product} "${slug}", which has no tenant in nit2`,
                fix: vhostCmd(v.file, [name]),
            })
        }
    }

    // 4) Certificates for a custom domain no vhost and no tenant uses any more.
    const certNames = new Set(Object.values(inventories).filter(Boolean).flatMap((inv) => inv.certs ?? []))
    const domains = new Set(tenants.map((t) => (t.customDomain ?? '').toLowerCase()).filter(Boolean))
    for (const c of certNames) {
        if (subdomainOf(c) || vhostNames.has(c) || domains.has(c) || infraNames.has(c) || ignored.has(c)) continue
        findings.push({ severity: 'low', kind: 'unused-cert', text: `certificate ${c} is not used by any vhost or tenant`, fix: `sudo certbot delete --cert-name ${c}` })
    }

    return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.slug ?? '').localeCompare(b.slug ?? ''))
}

/** checked: the products whose host answered — the report never claims more than that. */
export function formatReport(findings, { hosts, checked = [] }) {
    const lines = [`Orphan check — ${new Date().toISOString()}`, `hosts: ${hosts}`, '']
    if (!checked.length) return [...lines, '✖ no host could be checked — nothing was compared (see "hosts" above).'].join('\n')
    if (!findings.length) {
        const scope = checked.length === 2 ? 'both hosts' : `the ${checked[0]} host (the other one was NOT checked)`
        return [...lines, `✔ nothing left behind on ${scope}: every container, database, file, vhost, certificate and media folder belongs to a tenant.`].join('\n')
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
    const findings = analyze({
        tenants, inventories: { academy: academy.inv, store: store.inv },
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
