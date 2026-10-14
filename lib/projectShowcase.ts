/**
 * Server-side reads for the promo sections (service pages + Our Projects band).
 * Cached under the "projects" tag; the project API revalidates it on every write,
 * so adding/removing a promo in the dashboard changes the layout with no deploy.
 */
import { unstable_cache } from 'next/cache';
import prisma from '@/prisma/client';
import { orderForShowcase, pickFeatured, toShowcaseProject, type ShowcaseProject, type StoredProject } from '@/lib/promo';

export const PROJECTS_TAG = 'projects';

const SELECT = {
    id: true, img: true, title: true, titleEn: true, description: true, descriptionEn: true,
    types: true, links: true, order: true, promo: true, featuredOrder: true, services: true,
    categoryEn: true, categoryAr: true, features: true, keyResults: true,
} as const;

const loadForService = unstable_cache(
    async (service: string) => (await prisma.project.findMany({ where: { services: { has: service } }, select: SELECT, orderBy: { order: 'asc' } })) as StoredProject[],
    ['projects-for-service'],
    { tags: [PROJECTS_TAG], revalidate: 3600 },
);

const loadFeaturedCandidates = unstable_cache(
    async () => (await prisma.project.findMany({ where: { featuredOrder: { not: null } }, select: SELECT })) as StoredProject[],
    ['projects-featured'],
    { tags: [PROJECTS_TAG], revalidate: 3600 },
);

/** Projects tagged with a service page, promos first. Empty (section hidden) if the DB is unreachable. */
export async function getShowcaseProjects(service: string, locale: string): Promise<ShowcaseProject[]> {
    try {
        const projects = (await loadForService(service)).map((r) => ({ view: toShowcaseProject(r, locale), order: r.order ?? 0 }));
        return orderForShowcase(projects.map((p) => ({ ...p, promo: p.view.promo }))).map((p) => p.view);
    } catch (e) {
        console.error('[projectShowcase] service query failed:', (e as Error).message);
        return [];
    }
}

/** Up to three featured projects that have a promo. Empty → the band isn't rendered. */
export async function getFeaturedProjects(locale: string): Promise<ShowcaseProject[]> {
    try {
        return pickFeatured(await loadFeaturedCandidates()).map((r) => toShowcaseProject(r, locale)).filter((p) => p.promo);
    } catch (e) {
        console.error('[projectShowcase] featured query failed:', (e as Error).message);
        return [];
    }
}
