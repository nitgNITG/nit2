// Secondary Prisma client — MySQL, Academy control plane only.
// Generated from prisma/mysql/schema.prisma into node_modules/prismamysql, and
// externalized in next.config so Next never bundles its native query engine.
// The primary MongoDB client stays at `@/prisma/client`.
import { PrismaClient } from 'prismamysql'

const makeClient = () => new PrismaClient()

declare global {
    // eslint-disable-next-line no-var
    var prismaMysql: undefined | ReturnType<typeof makeClient>
}

const prismaMysql = globalThis.prismaMysql ?? makeClient()

export default prismaMysql

if (process.env.NODE_ENV !== 'production') globalThis.prismaMysql = prismaMysql
