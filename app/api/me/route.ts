import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Lets client components (the navbar) know who's signed in — the token cookie is
// httpOnly, so the browser can't read it directly.
export const dynamic = "force-dynamic";

export async function GET() {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
}
