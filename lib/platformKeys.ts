// Platform-wide settings keys — values that must be identical for every academy
// (bound to the app binary: OAuth client ids + app store URLs/versions). Kept in
// lib so the API route, the dashboard, and the provisioner can share one list.
// (A Next.js route.ts file may only export request handlers, so this can't live there.)
export const PLATFORM_KEYS = [
    'google_client_id',
    'google_client_secret',
    'apple_client_id',
    'facebook_app_id',
    'android_version',
    'android_url',
    'ios_version',
    'ios_url',
    // App video-overlay watermark style (served by getsettings.php).
    'watermark_color',
    'watermark_speed',
    'watermark_fontsize',
    // Shared legal links (app design-system) — default for every academy.
    'terms_url',
    'privacy_url',
    'about_url',
    'faq_url',
    // Published app + developer name (shown on the built-in legal/delete pages).
    'app_name',
] as const
