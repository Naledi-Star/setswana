import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { env } from '../src/config/env.js'
import { hashPassword, passwordPolicyError } from '../src/lib/passwords.js'
import { isProduction } from '../src/config/env.js'

const prisma = new PrismaClient()

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  const direct = process.argv.find((arg) => arg.startsWith(prefix))
  if (direct) return direct.slice(prefix.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  if (isProduction && !env.ALLOW_ADMIN_SEED) {
    throw new Error('Refusing to seed an admin in production without ALLOW_ADMIN_SEED=true.')
  }

  const email = argument('email')?.trim().toLowerCase()
  const password = argument('password')
  const displayName = argument('name') ?? 'Puo admin'

  if (!email || !password) {
    throw new Error('Usage: npm run seed:admin -- --email=you@example.com --password="..." [--name="..."]')
  }

  const policyError = passwordPolicyError(password, { email, displayName })
  if (policyError) throw new Error(policyError)

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      emailVerifiedAt: new Date(),
      passwordHash,
      displayName,
      role: 'ADMIN',
      stats: { create: {} },
    },
    update: {
      passwordHash,
      role: 'ADMIN',
    },
  })

  console.log(`Admin ready: ${user.email} (${user.id})`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
