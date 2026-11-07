import { Router } from 'express'
import type { NextFunction, Response } from 'express'
import { existsSync } from 'node:fs'
import { audioFileFromRelative } from '../../lib/media.js'
import { notFound } from '../../lib/errors.js'

export const mediaRouter = Router()

function sendAudio(relativePath: string, res: Response, next: NextFunction) {
  const file = audioFileFromRelative(relativePath)
  if (!file || !existsSync(file)) return next(notFound('Audio not found.'))

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Accept-Ranges', 'bytes')
  res.sendFile(file)
}

// Recordings are filed per lesson section: /media/Lesson%201%20section%201/dumela.m4a
mediaRouter.get('/:folder/:filename', (req, res, next) => {
  return sendAudio(`${req.params.folder}/${req.params.filename}`, res, next)
})

// Clips that still sit directly in content/audio stay addressable as /media/dumela.m4a.
mediaRouter.get('/:filename', (req, res, next) => {
  return sendAudio(req.params.filename, res, next)
})
