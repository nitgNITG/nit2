import { revalidatePath } from "next/cache";

/** Refresh the cached blog pages after a dashboard change, so visitors don't wait for the hourly ISR. */
export function revalidateBlog(...slugs: (string | null | undefined)[]) {
    try {
        for (const locale of ["ar", "en"]) {
            revalidatePath(`/${locale}/blog`, "page");
            revalidatePath(`/${locale}`, "page");
            for (const slug of slugs) if (slug) revalidatePath(`/${locale}/blog/${slug}`, "page");
        }
    } catch {
        // Outside a request (scripts/tests) there is nothing to revalidate.
    }
}
