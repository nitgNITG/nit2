import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/utils/validateEmail';
import prisma from '@/prisma/client';
import { cookies } from 'next/headers';

// Public sign-up. Creates a `client` account and logs them in (sets the token
// cookie). Admins are not created here — they already exist / are seeded.
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
        const user = await prisma.user.create({
            data: { name: String(name).trim(), email, password: hashedPassword, role: 'client' },
        });

        const token = jwt.sign({ id: user.id }, process.env.SECRET_JWT as string);
        cookies().set({ name: 'token', value: token, httpOnly: true, maxAge: 5454512 });

        return NextResponse.json({ message: 'تم إنشاء حسابك.' }, { status: 201 });
    } catch (error: any) {
        console.error('[register] error', error);
        return NextResponse.json({ message: 'حصل خطأ في السيرفر، حاول تاني.' }, { status: 500 });
    }
}
