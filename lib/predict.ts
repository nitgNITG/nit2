import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prismaMysql from '@/lib/prismaMysql';

// Like authPredict, but ALSO requires the user to be an admin (dashboard content
// APIs). The JWT only carries the id, so we look the role up (users live in MySQL).
// Legacy accounts with a null role are treated as admin (matches lib/auth).
export const authAdmin = async (req: NextRequest): Promise<boolean> => {
    try {
        let token = '';
        if (req) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) token = authHeader.split(' ')[1];
            else token = cookies().get('token')?.value ?? '';
        }
        if (!token) return false;
        const secret = process.env.SECRET_JWT;
        if (!secret) return false;
        const decoded = jwt.verify(token, secret) as JwtPayload;
        const id = decoded?.id;
        if (!id) return false;
        const user = await prismaMysql.user.findUnique({ where: { id }, select: { role: true } });
        return !!user && (user.role === 'admin' || user.role == null);
    } catch (error: any) {
        console.error('[Auth] admin check failed:', error.message);
        return false;
    }
};

export const authPredict = (req: NextRequest): boolean => {
    try {
        let token = '';
        if (req) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            } else {
                token = cookies().get('token')?.value ?? '';
            }
        }
        if (!token) { console.warn('[Auth] ❌ No token'); return false; }
        const secret = process.env.SECRET_JWT;
        if (!secret) { console.error('[Auth] ❌ SECRET_JWT not set'); return false; }
        const decoded = jwt.verify(token, secret) as JwtPayload;
        const isValid = !!decoded?.id;
        console.log('[Auth]', isValid ? '✅ Valid' : '❌ Invalid');
        return isValid;
    } catch (error: any) { console.error('[Auth] ❌ Verify failed:', error.message); return false; }
};
