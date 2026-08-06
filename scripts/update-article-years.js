/**
 * Bump outdated year references in blog articles to the current year.
 *
 *   Replaces standalone 2024 and 2025 with 2026 across every text field of
 *   every article and its sections (titles, intros, meta descriptions, section
 *   titles/content, and list items) — in both Arabic and English.
 *
 *   Historical years (2013, 2020) and forward-looking ones (Vision 2030) are
 *   intentionally left untouched. Slugs are NOT changed, so existing article
 *   URLs keep working.
 *
 * Usage (run on the server, where MongoDB is reachable):
 *   node scripts/update-article-years.js          # dry run — prints changes only
 *   node scripts/update-article-years.js --apply  # writes the changes to the DB
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const APPLY = process.argv.includes('--apply')

// Standalone 2024 / 2025 (not part of a longer number) -> 2026
const bump = (s) =>
    s == null ? s : s.replace(/(?<!\d)(2024|2025)(?!\d)/g, '2026')

const ARTICLE_FIELDS = ['title', 'titleEn', 'content', 'contentEn', 'metaDesc', 'metaDescEn']
const SECTION_FIELDS = ['title', 'titleEn', 'content', 'contentEn']
const LIST_FIELDS = ['title', 'titleEn', 'content', 'contentEn']

function diffObject(obj, fields) {
    const data = {}
    const log = []
    for (const f of fields) {
        const nv = bump(obj[f])
        if (nv !== obj[f]) {
            data[f] = nv
            log.push(`    ${f}: "${obj[f]}" -> "${nv}"`)
        }
    }
    return { data, log }
}

async function run() {
    const articles = await prisma.article.findMany({
        include: { Section: true },
    })

    let fieldChanges = 0
    let articlesTouched = 0
    let sectionsTouched = 0

    for (const article of articles) {
        const lines = []

        // Article-level fields
        const { data: articleData, log: articleLog } = diffObject(article, ARTICLE_FIELDS)
        lines.push(...articleLog)
        if (Object.keys(articleData).length && APPLY) {
            await prisma.article.update({ where: { id: article.id }, data: articleData })
        }
        fieldChanges += articleLog.length

        // Sections (+ embedded list items)
        for (const section of article.Section) {
            const { data: secData, log: secLog } = diffObject(section, SECTION_FIELDS)

            let listChanged = false
            const newList = (section.list || []).map((item) => {
                const { data, log } = diffObject(item, LIST_FIELDS)
                if (log.length) {
                    listChanged = true
                    secLog.push(...log.map((l) => `  ${l}`))
                }
                return { ...item, ...data }
            })
            if (listChanged) secData.list = newList

            if (secLog.length) {
                lines.push(`  [section ${section.id}]`)
                lines.push(...secLog)
                sectionsTouched++
                fieldChanges += secLog.length
                if (APPLY) {
                    await prisma.section.update({ where: { id: section.id }, data: secData })
                }
            }
        }

        if (lines.length) {
            articlesTouched++
            console.log(`\n■ ${article.slug || article.id}`)
            console.log(lines.join('\n'))
        }
    }

    console.log(
        `\n=== ${fieldChanges} field change(s) across ${articlesTouched} article(s), ${sectionsTouched} section(s) ===`
    )
    console.log(APPLY ? '✅ Changes written to the database.' : 'ℹ️  Dry run — re-run with --apply to write.')
}

run()
    .catch((e) => {
        console.error('Error:', e.message)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
