import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = res.locals.requestId as string | undefined

  if (error instanceof AppError) {
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter))
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
        requestId,
      },
    })
    return
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'body'
      if (!fields[key]) fields[key] = issue.message
    }
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Check the highlighted fields.',
        fields,
        requestId,
      },
    })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'That value is already in use.', requestId },
      })
      return
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.', requestId } })
      return
    }
  }

  logger.error({ err: error, requestId, path: req.path }, 'unhandled_error')
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.', requestId },
  })
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route for ${req.method} ${req.path}.`,
      requestId: res.locals.requestId,
    },
  })
}
