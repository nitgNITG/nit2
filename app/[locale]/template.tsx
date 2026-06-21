/**
 * Next.js App Router `template.tsx` re-mounts on every navigation (unlike layout.tsx),
 * so the `.page-enter` CSS animation replays each time a page in the navbar opens.
 * Pure CSS (opacity + transform) — no JS, no measurable performance cost.
 * Disabled automatically under `prefers-reduced-motion` (see globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="page-enter">{children}</div>
}
