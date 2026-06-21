/**
 * Next.js App Router `template.tsx` re-mounts on every navigation (unlike layout.tsx),
 * so this animate.css entrance replays each time a page in the navbar opens.
 * Pure CSS (opacity + transform) — no JS, no measurable performance cost.
 * Disabled automatically under `prefers-reduced-motion` (animate.css built-in).
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="animate__animated animate__fadeIn">{children}</div>
}
