// Upload a promo video (and optional .vtt captions) to Cloudinary and record it
// in scripts/data/promos.json for `node scripts/promo-apply.mjs`.
//
//   node scripts/promo-upload-video.mjs <video.mp4> --project "Tawreedat Go"
//        [--name tawreedat-go]          Cloudinary file name (default: from the project/file name)
//        [--teaser-start 4]             where the 8 s muted teaser starts (seconds, default 0)
//        [--poster-at 6]                poster frame (seconds, default teaser start + 1)
//        [--captions-en en.vtt] [--captions-ar ar.vtt]   only if captions aren't burned in
//        [--no-save]                    just print the result, don't touch promos.json
//
// Needs CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET (read from .env).
// Uploads in 20 MB chunks, into the same folder the dashboard uses (nit-promos/).
// Re-running with the same --name replaces the video in place.
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PROMO_FOLDER, loadEnv, parseArgs, readPromos, sameProject, writePromos } from './promo-common.mjs'

const USAGE = 'Usage: node scripts/promo-upload-video.mjs <video-file> --project "<project English title>" [--name x] [--teaser-start s] [--poster-at s] [--captions-en f.vtt] [--captions-ar f.vtt] [--no-save]'

/** A Cloudinary-safe file name: lowercase a–z, 0–9 and dashes. */
export function slugName(s) {
    return String(s ?? '').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

const seconds = (v, flag) => {
    if (v == null) return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${flag} must be a number of seconds ≥ 0`)
    return n
}

/** The promo object stored on the project (same shape the dashboard saves). */
export function promoFromUpload(video, { teaserStart = 0, posterAt = null, captionsEn = null, captionsAr = null } = {}) {
    return {
        videoUrl: video.secure_url,
        publicId: video.public_id,
        durationSec: video.duration ? Math.round(video.duration * 10) / 10 : null,
        teaserStart,
        posterAt,
        uploadDate: video.created_at ?? new Date().toISOString(),
        captionsEn,
        captionsAr,
    }
}

/** Put the promo on the project's entry in promos.json, creating the entry if needed. */
export function upsertPromo(data, project, promo) {
    const projects = [...(data.projects ?? [])]
    const i = projects.findIndex((p) => sameProject(p.match, project))
    if (i >= 0) projects[i] = { ...projects[i], promo }
    else projects.push({ match: project, promo })
    return { ...data, projects }
}

async function main() {
    const args = parseArgs(process.argv.slice(2), ['no-save'])
    const file = args._[0]
    if (!file || (!args.project && !args['no-save'])) throw new Error(USAGE)
    if (!existsSync(file)) throw new Error(`File not found: ${file}`)
    for (const k of ['captions-en', 'captions-ar']) {
        if (args[k] && (!existsSync(args[k]) || !/\.vtt$/i.test(args[k]))) throw new Error(`--${k} must be an existing .vtt file`)
    }
    const teaserStart = seconds(args['teaser-start'], '--teaser-start') ?? 0
    const posterAt = seconds(args['poster-at'], '--poster-at')

    loadEnv()
    const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env
    if (!cloud_name || !api_key || !api_secret) throw new Error('CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set (.env)')
    const { v2: cloudinary } = await import('cloudinary')
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true })

    const name = slugName(args.name || args.project || path.basename(file))
    const mb = (statSync(file).size / 1024 / 1024).toFixed(1)
    console.log(`Uploading ${path.basename(file)} (${mb} MB) → ${cloud_name}/${PROMO_FOLDER}/${name} …`)
    const video = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(file, {
            resource_type: 'video', folder: PROMO_FOLDER, public_id: name, overwrite: true, invalidate: true,
            chunk_size: 20 * 1024 * 1024,
        }, (err, res) => (err ? reject(new Error(err.message ?? String(err))) : resolve(res)))
    })
    console.log(`✔ video  ${video.secure_url}${video.duration ? ` (${Math.round(video.duration)} s)` : ''}`)

    const captions = {}
    for (const [flag, key] of [['captions-en', 'captionsEn'], ['captions-ar', 'captionsAr']]) {
        if (!args[flag]) continue
        const res = await cloudinary.uploader.upload(args[flag], {
            resource_type: 'raw', folder: `${PROMO_FOLDER}/captions`, public_id: `${name}-${key === 'captionsEn' ? 'en' : 'ar'}.vtt`, overwrite: true,
        })
        captions[key] = res.secure_url
        console.log(`✔ ${flag} ${res.secure_url}`)
    }

    const promo = promoFromUpload(video, { teaserStart, posterAt, ...captions })
    if (args['no-save']) {
        console.log(JSON.stringify(promo, null, 2))
        return
    }
    writePromos(upsertPromo(readPromos(), args.project, promo))
    console.log(`\nSaved on "${args.project}" in scripts/data/promos.json.\nNext: node scripts/promo-apply.mjs --dry-run   (then without --dry-run)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => { console.error(`✖ ${e.message ?? e}`); process.exit(1) })
}
