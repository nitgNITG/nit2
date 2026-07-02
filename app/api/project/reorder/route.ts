import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/prisma/client';
import { authPredict } from '@/lib/predict';

export async function PATCH(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });

        const body = await req.json();
        const { id, direction, type } = body as { id: string; direction: 'up' | 'down'; type: string };

        if (!id || !direction || !type) {
            return NextResponse.json({ message: 'Missing required fields: id, direction, type' }, { status: 400 });
        }

        // Fetch all projects with this type, sorted by order
        const projectsOfType = await prisma.project.findMany({
            where: { types: { has: type } },
            select: { id: true, order: true },
            orderBy: { order: 'asc' },
        });

        const index = projectsOfType.findIndex((p) => p.id === id);
        if (index === -1) {
            return NextResponse.json({ message: 'Project not found in that type' }, { status: 404 });
        }

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= projectsOfType.length) {
            return NextResponse.json({ message: 'Cannot move in that direction' }, { status: 400 });
        }

        const current = projectsOfType[index];
        const neighbour = projectsOfType[swapIndex];

        // Swap order values
        await prisma.project.update({ where: { id: current.id }, data: { order: neighbour.order } });
        await prisma.project.update({ where: { id: neighbour.id }, data: { order: current.order } });

        return NextResponse.json({ message: 'Reordered successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('[PATCH /api/project/reorder] ❌', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}
