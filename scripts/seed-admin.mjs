// Create (or reset) a ready admin account.
//
//   node scripts/seed-admin.mjs                         # admin@gmail.com / Admin@1234
//   node scripts/seed-admin.mjs foo@bar.com MyPass#99   # custom
//
// Users live in MySQL now — run where MYSQL_DATABASE_URL points at the real DB.
// Requires: npx prisma generate --schema prisma/mysql/schema.prisma
// Idempotent — safe to re-run.
import { PrismaClient } from 'prismamysql'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const email = process.argv[2] || 'admin@gmail.com'
const password = process.argv[3] || 'Admin@1234'

try {
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.upsert({
        where: { email },
        update: { password: hash, role: 'admin' },
        create: { email, password: hash, role: 'admin', name: 'Admin' },
    })
    console.log(`✔ Admin ready: ${user.email} (role=admin)`)
    console.log(`  Log in at /dashboard with this email + the password you set.`)
} catch (e) {
    console.error('✖ Failed:', e.message)
    process.exit(1)
} finally {
    await prisma.$disconnect()
}
