// Platform-wide settings keys — values that must be identical for every academy
// (bound to the app binary: OAuth client ids + app store URLs/versions). Kept in
// lib so the API route, the dashboard, and the provisioner can share one list.
// (A Next.js route.ts file may only export request handlers, so this can't live there.)
export const PLATFORM_KEYS = [
    'google_client_id',
    'apple_client_id',
    'facebook_app_id',
    'android_version',
    'android_url',
    'ios_version',
    'ios_url',
] as const
