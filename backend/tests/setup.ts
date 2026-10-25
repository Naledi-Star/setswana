import 'dotenv/config'

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef0123456789abcdef'
process.env.PUSH_ENABLED = 'false'
