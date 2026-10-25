export type FieldErrors = Record<string, string>

export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: FieldErrors
  readonly retryAfter?: number

  constructor(
    status: number,
    code: string,
    message: string,
    options: { fields?: FieldErrors; retryAfter?: number } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = options.fields
    this.retryAfter = options.retryAfter
  }
}

export const badRequest = (message: string, fields?: FieldErrors) =>
  new AppError(400, 'VALIDATION_FAILED', message, { fields })

export const unauthorized = (message = 'Sign in to continue.') =>
  new AppError(401, 'UNAUTHENTICATED', message)

export const forbidden = (message = 'You do not have access to this.') =>
  new AppError(403, 'FORBIDDEN', message)

export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message)

export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message)

export const rateLimited = (message: string, retryAfter: number) =>
  new AppError(429, 'RATE_LIMITED', message, { retryAfter })
