// Build the "connect" links an academy shows so the white-label NIT Academy app
// opens already pointed at that academy's site. Spec: TENANT_CONNECT_LINKS.md.
// Everything is derived from the site URL; the same helper feeds the owner's
// dashboard card and (later) the welcome email.
//
// PLACEHOLDERS (per the doc): `nitacademy://` is the app's current deep-link
// scheme and the `go.nitg-eg.com` https hub is NOT live yet — so we emit only
// the deep link + the Play install-referrer link, never an https hub link.

export const ANDROID_APP_ID = 'com.nit.academy'
export const APP_SCHEME = 'nitacademy'

export type ConnectLinks = {
    /** https://<slug>.<domain> — the canonical academy site (the one input). */
    site: string
    /** nitacademy://connect?base=<enc> — opens the app straight to this academy. */
    deeplink: string
    /** Play Store URL carrying the site in the install referrer (auto-connects on first launch). */
    playUrl: string
}

/**
 * Given an academy slug + the base domain, build its connect links.
 * One link set per academy — always pass that academy's own slug, never reuse a base.
 */
export function connectLinks(slug: string, domain: string): ConnectLinks {
    const site = `https://${slug}.${domain}`
    const enc = encodeURIComponent(site) // https%3A%2F%2F…
    const deeplink = `${APP_SCHEME}://connect?base=${enc}`
    // The referrer is `base=<enc>` encoded a SECOND time, because it nests inside the Play URL.
    const referrer = encodeURIComponent(`base=${enc}`)
    const playUrl = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}&referrer=${referrer}`
    return { site, deeplink, playUrl }
}
