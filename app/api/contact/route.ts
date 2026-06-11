import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client';
import { authPredict } from "@/lib/predict";
import { computeLeadScore } from "@/utils/leadScore";

// ── Disposable / known-spam email domains ─────────────────────────────────────
const BLOCKED_DOMAINS = new Set([
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
    'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'trashmail.me',
    'trashmail.at', 'trashmail.io', 'trashmail.xyz', 'fakeinbox.com',
    'dispostable.com', 'mailnull.com', 'maildrop.cc', 'spamgourmet.com',
    '10minutemail.com', 'temp-mail.org', 'getnada.com', 'discard.email',
    'spamhereplease.com', 'spamthisplease.com',
]);

// ── Simple in-memory rate limiter: max 3 submissions per IP per 10 min ────────
const ipCache = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = ipCache.get(ip);
    if (!entry || now > entry.resetAt) {
        ipCache.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true; // allowed
    }
    if (entry.count >= RATE_LIMIT) return false; // blocked
    entry.count++;
    return true;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, phone, subject, message, country, service, budget, timeline, role, pain, _hp,
                sourcePage, sourceRef, utmSource, utmMedium, utmCampaign } = body;

        // ── Honeypot check (bots fill hidden fields, humans don't) ────────────
        if (_hp) {
            console.warn('[Contact] 🍯 Honeypot triggered');
            return NextResponse.json({ message: 'تم الارسال بنجاح' }, { status: 201 }); // fake success
        }

        // ── Rate limit by IP ──────────────────────────────────────────────────
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        if (!checkRateLimit(ip)) {
            console.warn(`[Contact] 🚫 Rate limit hit: ${ip}`);
            return NextResponse.json({ message: 'لقد تجاوزت الحد المسموح. يرجى المحاولة لاحقاً.' }, { status: 429 });
        }

        if (!name || !email || !phone || !subject || !message)
            return NextResponse.json({ message: 'يرجي ادخال جميع البيانات' }, { status: 400 });

        // ── Blocked / disposable email domain ────────────────────────────────
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain || BLOCKED_DOMAINS.has(domain)) {
            console.warn(`[Contact] 🚫 Blocked domain: ${domain}`);
            return NextResponse.json({ message: 'يرجى استخدام بريد إلكتروني صحيح' }, { status: 400 });
        }

        // ── Message too short (likely spam) ──────────────────────────────────
        if (message.trim().length < 10) {
            return NextResponse.json({ message: 'يرجى كتابة رسالة أكثر تفصيلاً' }, { status: 400 });
        }

        const { score, stage } = computeLeadScore({ email, phone, role, service, budget, timeline, pain, message });

        await prisma.contact.create({
            data: {
                name, email, phone, subject, message, country, service, budget, timeline, role, pain, score, stage,
                sourcePage, sourceRef, utmSource, utmMedium, utmCampaign,
            },
        });

        console.log(`[Contact] ✅ ${email} → stage:${stage} score:${score} | from:${sourcePage} ref:${sourceRef ?? 'direct'} utm:${utmSource ?? '-'}`);

        // WhatsApp notification for hot leads (SQL / Opportunity)
        if (stage === 'sql' || stage === 'opportunity') {
            const NOTIFY_NUMBER = process.env.WHATSAPP_NOTIFY_NUMBER; // e.g. +201091568240
            if (NOTIFY_NUMBER) {
                const msg = encodeURIComponent(
                    `🔥 Lead جديد!\nالاسم: ${name}\nالخدمة: ${service ?? '—'}\nالميزانية: ${budget ?? '—'}\nالدولة: ${country ?? '—'}\nالهاتف: ${phone ?? '—'}\nمن: ${sourcePage ?? '/'}`
                );
                // Log the WhatsApp link — can be used with any WA gateway/webhook
                console.log(`[Contact] 🔔 Hot lead WA link: https://wa.me/${NOTIFY_NUMBER.replace('+','')}?text=${msg}`);
            }
        }
        return NextResponse.json({ message: 'تم الارسال بنجاح' }, { status: 201 });
    } catch (error: any) {
        console.error('[Contact POST]', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });

        const { searchParams } = new URL(req.url);

        // Unread count
        if (searchParams.get('isRead')) {
            const count = await prisma.contact.count({ where: { isReaded: false } });
            return NextResponse.json({ count }, { status: 200 });
        }

        // Funnel summary + service breakdown + country breakdown
        if (searchParams.get('summary')) {
            const COUNTRIES = ['sa', 'ae', 'qa', 'kw', 'bh', 'om', 'jo', 'eg', 'other'];
            const SOURCE_PAGES = ['/', '/contact', '/moodle-lms', '/ecommerce-app', '/get-quote', '/blog', '/who-us', '/our-projects'];
            const [lead, mql, sql, opportunity, moodle, ecommerce, custom, svcOther, ...rest] = await Promise.all([
                prisma.contact.count({ where: { stage: 'lead' } }),
                prisma.contact.count({ where: { stage: 'mql' } }),
                prisma.contact.count({ where: { stage: 'sql' } }),
                prisma.contact.count({ where: { stage: 'opportunity' } }),
                prisma.contact.count({ where: { service: 'moodle' } }),
                prisma.contact.count({ where: { service: 'ecommerce' } }),
                prisma.contact.count({ where: { service: 'custom' } }),
                prisma.contact.count({ where: { service: 'other' } }),
                ...COUNTRIES.map(c => prisma.contact.count({ where: { country: c } })),
                ...SOURCE_PAGES.map(p => prisma.contact.count({ where: { sourcePage: { contains: p } } })),
            ]);
            const countryCounts = rest.slice(0, COUNTRIES.length);
            const pageCounts    = rest.slice(COUNTRIES.length);
            const countries = Object.fromEntries(
                COUNTRIES.map((c, i) => [c, countryCounts[i]]).filter(([, v]) => (v as number) > 0)
            );
            const pages = Object.fromEntries(
                SOURCE_PAGES.map((p, i) => [p, pageCounts[i]]).filter(([, v]) => (v as number) > 0)
            );
            return NextResponse.json({ lead, mql, sql, opportunity, services: { moodle, ecommerce, custom, other: svcOther }, countries, pages }, { status: 200 });
        }

        // Paginated list (with optional stage/status filter)
        const skip  = parseInt(searchParams.get('skip')   || '0');
        const stage  = searchParams.get('stage')  || undefined;
        const status = searchParams.get('status') || undefined;

        const contacts = await prisma.contact.findMany({
            where: { ...(stage ? { stage } : {}), ...(status ? { status } : {}) },
            skip,
            take: 20,
            orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        });
        return NextResponse.json({ contacts }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

// Mark all as read
export async function PUT(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        await prisma.contact.updateMany({ data: { isReaded: true } });
        return NextResponse.json({ message: 'Successfully updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

// Delete a contact by id
export async function DELETE(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
        await prisma.contact.delete({ where: { id } });
        return NextResponse.json({ message: 'Deleted' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

// Update status / notes per contact
export async function PATCH(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { id, status, notes } = await req.json();
        if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
        const updated = await prisma.contact.update({
            where: { id },
            data: { ...(status ? { status } : {}), ...(notes !== undefined ? { notes } : {}) },
        });
        return NextResponse.json({ contact: updated }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}
