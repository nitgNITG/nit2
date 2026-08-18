// Promote an existing user to admin (or demote back to client).
//
//   node scripts/make-admin.mjs someone@example.com          # → admin
//   node scripts/make-admin.mjs someone@example.com client   # → client
//
// Run where DATABASE_URL points at the real database (e.g. on the dev server,
// or locally if your .env has the real Mongo URL).
import { PrismaClient } from '@prisma/client'

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
