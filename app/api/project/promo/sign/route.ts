import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/predict';
import { signPromoUpload } from '@/lib/promoCloudinary';

// POST /api/project/promo/sign  { kind: "video" | "raw" }
// Admin only. Returns the signed params for a direct browser → Cloudinary upload.
export async function POST(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const kind = body?.kind === 'raw' ? 'raw' : 'video';
    const signed = signPromoUpload(kind);
    if (!signed) return NextResponse.json({ message: 'Cloudinary is not configured on the server' }, { status: 503 });
    return NextResponse.json(signed, { status: 200 });
}
