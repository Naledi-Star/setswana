import { Algorithm, hash, verify } from '@node-rs/argon2'

const ARGON_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'letmein1',
  'iloveyou',
  'welcome1',
  'admin123',
  'setswana',
  'dumela123',
  'puo12345',
])

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

export function passwordPolicyError(
  password: string,
  context: { email?: string | null; displayName?: string | null } = {},
): string | null {
  if (password.length < 10) return 'Use at least 10 characters.'
  if (password.length > 128) return 'Use at most 128 characters.'
  if (!/[a-zA-Z]/.test(password)) return 'Include at least one letter.'
  if (!/[0-9]/.test(password)) return 'Include at least one number.'
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'That password is too common.'

  const email = context.email?.toLowerCase()
  if (email && password.toLowerCase().includes(email.split('@')[0] ?? '')) {
    return 'Do not use your email address in the password.'
  }
  const name = context.displayName?.toLowerCase()
  if (name && name.length >= 3 && password.toLowerCase().includes(name)) {
    return 'Do not use your name in the password.'
  }

  return null
}
