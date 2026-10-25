import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ISSUER: z.string().default('puo-api'),
  AUDIENCE: z.string().default('puo-mobile'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default(''),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  MEDIA_BASE_URL: z.string().default('http://localhost:4000/media'),
  GOOGLE_CLIENT_IDS: z.string().default(''),
  EMAIL_TRANSPORT: z.enum(['console', 'disabled']).default('console'),
  EMAIL_FROM: z.string().default('Puo <hello@example.com>'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => (value === 'true' ? 1 : value === 'false' ? false : Number(value))),
  PUSH_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  ALLOW_ADMIN_SEED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`)
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

export const googleClientIds = env.GOOGLE_CLIENT_IDS.split(',')
  .map((id) => id.trim())
  .filter(Boolean)

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
