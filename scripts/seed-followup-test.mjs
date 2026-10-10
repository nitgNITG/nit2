// Test data for the phase 4 follow-ups (UAT). Creates backdated leads and chats so
// the next daily job (E18) has one case of each kind to draft:
//   [TEST] Due lead        — contact-form lead, next follow-up = today      → draft (email if --email, else WhatsApp)
//   [TEST] Checkout lead   — got a checkout button 50 h ago, never paid       → draft "Checkout not paid"
//   [TEST] Came back? yes  — left a number, said YES to contact, gone 30 h    → draft "Didn't come back"
//   [TEST] Came back? no   — left a number, said NO to contact, gone 30 h     → NO draft (consent)
// Everything is marked (Contact.subject = "[FOLLOWUP-TEST]") and removed with --clean.
// Nothing is sent: drafts wait in Dashboard → Follow-ups for someone to approve.
//
//   node scripts/seed-followup-test.mjs --phone +201001234567 [--email you@nitg-eg.com]
//   node scripts/seed-followup-test.mjs --clean
//
// Use YOUR OWN number / email: approving a draft really sends it there.
import { pathToFileURL } from 'node:url'

export const MARK = '[FOLLOWUP-TEST]'
const H = 3600_000

/** 09:00 Cairo today as a UTC Date (the daily job matches the whole Cairo day). */
function cairoNineToday(now) {
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now)
    const [y, m, d] = ymd.split('-').map(Number)
    const guess = new Date(Date.UTC(y, m - 1, d, 9, 0))
    const cairoHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23' }).format(guess))
    return new Date(guess.getTime() - (cairoHour - 9) * H)
}

/**
 * @param {any} prisma the Mongo Prisma client
 * @param {{ phone: string, email?: string | null, now?: Date }} opts
 */
export async function seedFollowupTest(prisma, { phone, email = null, now = new Date() }) {
    if (!/^\+\d{8,15}$/.test(phone ?? '')) throw new Error('--phone must be your full number with country code, e.g. +201001234567')
    if (email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) throw new Error('--email is not a valid address')
    const ago = (h) => new Date(now.getTime() - h * H)
    const lead = (data) => prisma.contact.create({ data: { email: '', message: 'Follow-up UAT test lead', subject: MARK, status: 'new', ...data } })
    async function chat(contact, { hoursAgo, locale, visitor, assistant }) {
        const conv = await prisma.conversation.create({
            data: {
                channel: 'web', mode: 'sales', status: 'closed', locale, contactId: contact.id, sourcePage: 'followup-test',
                messageCount: 2, lastMessageAt: ago(hoursAgo), createdAt: ago(hoursAgo + 0.2), turnLockUntil: new Date(0), stateVersion: 0, tokensIn: 0, tokensOut: 0,
            },
        })
        await prisma.chatMessage.create({ data: { conversationId: conv.id, role: 'visitor', content: visitor, status: 'sent', createdAt: ago(hoursAgo + 0.1) } })
        await prisma.chatMessage.create({ data: { conversationId: conv.id, role: 'assistant', content: assistant, status: 'sent', createdAt: ago(hoursAgo) } })
        await prisma.contact.update({ where: { id: contact.id }, data: { conversationId: conv.id } })
        return conv
    }

    const due = await lead({
        name: '[TEST] Due lead', sourcePage: '/contact', service: 'moodle', country: 'eg', pain: 'Moodle LMS for a training centre',
        nextFollowUpAt: cairoNineToday(now), ...(email ? { email } : { whatsapp: phone, phone }),
    })

    const checkout = await lead({ name: '[TEST] Checkout lead', sourcePage: 'chat', whatsapp: phone, phone, consentContact: true, consentAt: ago(52), service: 'moodle', country: 'eg' })
    const checkoutChat = await chat(checkout, { hoursAgo: 50, locale: 'en', visitor: 'I want the academy Standard plan, annual.', assistant: 'Here is the button to subscribe to Standard.' })
    await prisma.toolAudit.create({
        data: {
            conversationId: checkoutChat.id, turnId: 'followup-test', tool: 'start_checkout', status: 'ok', latencyMs: 1,
            argsRedacted: { product: 'academy', tier: 'standard', cycle: 'annual' }, authContext: { mode: 'sales', channel: 'web', signedIn: false }, createdAt: ago(50),
        },
    })

    const yes = await lead({ name: '[TEST] Came back? yes', sourcePage: 'chat', whatsapp: phone, phone, consentContact: true, consentAt: ago(31), pain: 'منصة تعليمية لـ 300 موظف' })
    await chat(yes, { hoursAgo: 30, locale: 'ar', visitor: 'محتاج منصة تعليمية لـ 300 موظف، رقمي ' + phone, assistant: 'تمام! هل تحب نتواصل معاك على واتساب؟' })

    const no = await lead({ name: '[TEST] Came back? no', sourcePage: 'chat', whatsapp: phone, phone, consentContact: false, consentAt: ago(31) })
    await chat(no, { hoursAgo: 30, locale: 'en', visitor: 'Just browsing, here is my number ' + phone + ' but please do not contact me.', assistant: 'No problem, we will not contact you.' })

    return { due: due.id, checkout: checkout.id, yes: yes.id, no: no.id }
}

export async function cleanFollowupTest(prisma) {
    const contacts = await prisma.contact.findMany({ where: { subject: MARK }, select: { id: true } })
    const contactIds = contacts.map((c) => c.id)
    if (!contactIds.length) return { contacts: 0, conversations: 0, messages: 0 }
    const convs = await prisma.conversation.findMany({ where: { contactId: { in: contactIds } }, select: { id: true } })
    const convIds = convs.map((c) => c.id)
    const messages = convIds.length ? (await prisma.chatMessage.deleteMany({ where: { conversationId: { in: convIds } } })).count : 0
    if (convIds.length) await prisma.toolAudit.deleteMany({ where: { conversationId: { in: convIds } } })
    for (const id of convIds) await prisma.idempotencyRecord.deleteMany({ where: { key: { in: [`followup:checkout:${id}`, `followup:abandoned:${id}`] } } })
    for (const id of contactIds) await prisma.idempotencyRecord.deleteMany({ where: { key: { startsWith: `followup:due:${id}:` } } })
    await prisma.activity.deleteMany({ where: { contactId: { in: contactIds } } })
    const conversations = convIds.length ? (await prisma.conversation.deleteMany({ where: { id: { in: convIds } } })).count : 0
    const removed = (await prisma.contact.deleteMany({ where: { id: { in: contactIds } } })).count
    return { contacts: removed, conversations, messages }
}

function arg(name) {
    const i = process.argv.indexOf(name)
    return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    try {
        if (process.argv.includes('--clean')) {
            console.log('Removed:', await cleanFollowupTest(prisma))
            return
        }
        await cleanFollowupTest(prisma) // start fresh each time
        const ids = await seedFollowupTest(prisma, { phone: arg('--phone'), email: arg('--email') ?? null })
        console.log('Created 4 test leads:', ids)
        console.log('Next: run the daily job (GitHub → Actions → agent-daily-cron → Run workflow), then open Dashboard → Follow-ups.')
        console.log('Expected: 3 drafts (Due lead, Checkout lead, Came back? yes) — none for "Came back? no".')
        console.log('Clean up afterwards: node scripts/seed-followup-test.mjs --clean')
    } catch (e) {
        console.error(e.message)
        process.exitCode = 1
    } finally {
        await prisma.$disconnect()
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
