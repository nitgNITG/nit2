import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-revalidate-secret');
    if (secret !== process.env.SITE_JWT_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await req.json().catch(() => ({}));

    // Revalidate blog listing pages
    revalidatePath('/ar/blog', 'page');
    revalidatePath('/en/blog', 'page');

    // Revalidate the specific article if slug provided
    if (slug) {
        revalidatePath(`/ar/blog/${slug}`, 'page');
        revalidatePath(`/en/blog/${slug}`, 'page');
    }

    return NextResponse.json({ revalidated: true });
}
