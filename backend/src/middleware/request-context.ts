import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'

export function requestContext(req: Request, res: Response, next: () => void) {
  const incoming = req.header('x-request-id')
  const requestId = incoming && incoming.length <= 64 ? incoming : randomUUID()
  res.locals.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
}
