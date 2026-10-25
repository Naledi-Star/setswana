import type { Role } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      auth?:
        | { kind: 'user'; userId: string; role: Role }
        | { kind: 'guest'; guestId: string }
    }
  }
}

export {}
