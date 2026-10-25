import pino from 'pino'
import { env, isProduction, isTest } from '../config/env.js'

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'refreshToken',
      'idToken',
      'token',
      '*.password',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  enabled: !isTest,
})
