import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from '@/prisma/client';

export type SessionUser = {
    id: string;
    email: string;
    name: string | null;
    role: 'admin' | 'client';
};

/**
 * Reads the `token` cookie, verifies the JWT, and returns the logged-in user
 * (or null). Legacy accounts created before roles existed have `role = null`
 * in the DB — since the only such account is the original site admin, we treat
 * a null role as "admin".
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
    try {
        const token = cookies().get('token')?.value;
        if (!token) return null;
        const secret = process.env.SECRET_JWT;
        if (!secret) return null;
        const decoded = jwt.verify(token, secret) as JwtPayload;
        const id = decoded?.id as string | undefined;
        if (!id) return null;
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return null;
        return {
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            role: user.role === 'client' ? 'client' : 'admin',
        };
    } catch {
        return null;
    }
}
