// Promote an existing user to admin (or demote back to client).
//
//   node scripts/make-admin.mjs someone@example.com          # → admin
//   node scripts/make-admin.mjs someone@example.com client   # → client
//
// Users live in MySQL now — run where MYSQL_DATABASE_URL points at the real DB.
// Requires: npx prisma generate --schema prisma/mysql/schema.prisma
import { PrismaClient } from 'prismamysql'

const prisma = new PrismaClient()
const email = process.argv[2]
const role = process.argv[3] === 'client' ? 'client' : 'admin'

if (!email) {
    console.error('Usage: node scripts/make-admin.mjs <email> [admin|client]')
    process.exit(1)
}

try {
    const user = await prisma.user.update({ where: { email }, data: { role } })
    console.log(`✔ ${user.email} is now: ${role}`)
} catch (e) {
    console.error('✖ Could not update — is the email correct?', e.message)
    process.exit(1)
} finally {
    await prisma.$disconnect()
}
