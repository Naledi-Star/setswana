import { Router } from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { audioDir, isSafeAudioFilename } from '../../lib/media.js'
import { notFound } from '../../lib/errors.js'

export const mediaRouter = Router()

mediaRouter.get('/:filename', (req, res, next) => {
  const filename = req.params.filename ?? ''
  if (!isSafeAudioFilename(filename)) return next(notFound('Audio not found.'))

  const file = path.join(audioDir, filename)
  if (!file.startsWith(audioDir) || !existsSync(file)) return next(notFound('Audio not found.'))

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Accept-Ranges', 'bytes')
  res.sendFile(file)
})
