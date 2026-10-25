import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import { corsOrigins, env, isTest } from './config/env.js'
import { logger } from './lib/logger.js'
import { authenticate } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { requestContext } from './middleware/request-context.js'
import { authenticatedLimiter, publicLimiter } from './middleware/rate-limit.js'
import { authRouter } from './modules/auth/routes.js'
import { usersRouter } from './modules/users/routes.js'
import { configRouter } from './modules/config/routes.js'
import { contentRouter } from './modules/content/routes.js'
import { attemptsRouter } from './modules/attempts/routes.js'
import { wordsRouter } from './modules/words/routes.js'
import { progressRouter } from './modules/progress/routes.js'
import { devicesRouter } from './modules/devices/routes.js'
import { adminRouter } from './modules/admin/routes.js'
import { mediaRouter } from './modules/media/routes.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)

  app.use(requestContext)

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' },
        customLogLevel: (_req, res, error) =>
          error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      }),
    )
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  app.use(
    cors({
      origin: corsOrigins.length ? corsOrigins : false,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
      maxAge: 600,
    }),
  )

  app.use(express.json({ limit: '100kb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  app.use('/media', publicLimiter, mediaRouter)

  app.use('/api/v1', authenticate)
  app.use('/api/v1', authenticatedLimiter)

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1', configRouter)
  app.use('/api/v1', usersRouter)
  app.use('/api/v1', contentRouter)
  app.use('/api/v1', attemptsRouter)
  app.use('/api/v1', wordsRouter)
  app.use('/api/v1', progressRouter)
  app.use('/api/v1', devicesRouter)
  app.use('/api/v1/admin', adminRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
