import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/utils/validateEmail';
// Users live in MySQL (academy control plane), not the Mongo content DB.
import prisma from '@/lib/prismaMysql';
import { cookies } from 'next/headers';
import { mailerConfigured } from '@/lib/mailer';
import { createAndSendOtp } from '@/lib/emailOtp';

// Public sign-up. Creates a `client` account. When SMTP is configured, the account
// starts UNVERIFIED and a verification code is emailed — the client verifies (which
// logs them in) instead of being auto-logged-in here. Without SMTP it falls back to
// the old behaviour (auto-login). Admins are seeded elsewhere, not created here.
export async function POST(req: NextRequest) {
    try {
        const { name, email, password } = await req.json();

        if (!name || String(name).trim().length < 2) {
            return NextResponse.json({ message: 'اكتب اسمك.' }, { status: 400 });
        }
        if (!validateEmail(email)) {
            return NextResponse.json({ message: 'البريد الإلكتروني غير صحيح.' }, { status: 400 });
        }
        if (!password || String(password).length < 8) {
            return NextResponse.json({ message: 'كلمة السر لازم 8 أحرف على الأقل.' }, { status: 400 });
        }

        const existing = await prisma.user.findFirst({ where: { email } });
        if (existing) {
            return NextResponse.json({ message: 'البريد ده مسجّل بالفعل، سجّل الدخول.' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const locale = ((req.headers.get('accept-language') || '').toLowerCase().startsWith('en')) ? 'en' : 'ar';
        const user = await prisma.user.create({
            data: { name: String(name).trim(), email: String(email).toLowerCase(), password: hashedPassword, role: 'client' },
        });

        // Email-verification flow (only when SMTP is set): send a code and DON'T
        // log in yet — the client verifies via /api/auth/verify-email, which signs
        // them in. Falls back to auto-login when no mailer is configured.
        if (mailerConfigured()) {
            await createAndSendOtp(String(email).toLowerCase(), 'verify', { name: String(name).trim(), locale }).catch(() => {});
            return NextResponse.json({ message: 'تم إنشاء حسابك. راجع بريدك لتأكيد الحساب.', needsVerify: true, email: String(email).toLowerCase() }, { status: 201 });
        }

        const token = jwt.sign({ id: user.id }, process.env.SECRET_JWT as string);
        cookies().set({ name: 'token', value: token, httpOnly: true, maxAge: 5454512 });

        return NextResponse.json({ message: 'تم إنشاء حسابك.' }, { status: 201 });
    } catch (error: any) {
        console.error('[register] error', error);
        return NextResponse.json({ message: 'حصل خطأ في السيرفر، حاول تاني.' }, { status: 500 });
    }
}
