import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt'
import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/utils/validateEmail';
import prisma from '@/prisma/client'
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();
        if (!validateEmail(email))
            return NextResponse.json({ message: 'Invalid email address.' }, { status: 400 })
        if (!password)
            return NextResponse.json({ message: 'Password is required.' }, { status: 400 })
        const user = await prisma.user.findFirst({ where: { email: email } })
        if (!user)
            return NextResponse.json({ message: 'This not admin.' }, { status: 404 })
        const isValidPassword = await bcrypt.compare(password, user.password)
        if (!isValidPassword)
            return NextResponse.json({ message: 'Invalid Password.' }, { status: 404 })
        const token = jwt.sign({ id: user.id }, process.env.SECRET_JWT as string)
        cookies().set({
            name: 'token',
            value: token,
            httpOnly: true,
            maxAge: 5454512,
        })
        return NextResponse.json({ message: "Successfully!!" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
// export async function POST(req: NextRequest) {
//     try {
//         const { email, password } = await req.json();
//         if (!validateEmail(email))
//             return NextResponse.json({ message: 'Invalid email address.' }, { status: 400 })
//         if (!password)
//             return NextResponse.json({ message: 'Password is required.' }, { status: 400 })
//         const hashedPassword = await bcrypt.hash(password, 10);
//         const user = await prisma.user.create({ data: { email, password: hashedPassword } })
//         const token = jwt.sign({ id: user.id }, process.env.SECRET_JWT as string)
//         cookies().set({
//             name: 'token',
//             value: token,
//             httpOnly: true,
//             maxAge: 5454512,
//         })
//         return NextResponse.json({ message: "Successfully!!" }, { status: 201 })
//     } catch (error: any) {
//         return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
//     }
// }