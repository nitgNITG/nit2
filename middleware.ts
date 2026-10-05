import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

const intl = createMiddleware({
    // A list of all locales that are supported
    locales: ['en', 'ar'],

    // Used when no locale matches
    defaultLocale: 'ar',
    localeDetection: false
});

// The dashboard layout needs the requested path server-side to decide which pages
// an AI-agent staff member may open. next-intl forwards the request headers on its
// rewrite, so set it here — always overwritten, so a client can't supply its own.
export default function middleware(req: NextRequest) {
    const headers = new Headers(req.headers);
    headers.set('x-nit-pathname', req.nextUrl.pathname);
    return intl(new NextRequest(req, { headers }));
}

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(ar|en)/:path*']
};
