import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

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
