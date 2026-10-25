import { Router } from 'express'
import { getTunables } from '../../config/app-config.js'
import { publicConfig } from '../../config/tunables.js'
import { asyncHandler } from '../../lib/http.js'

export const configRouter = Router()

configRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const tunables = await getTunables()
    res.json(publicConfig(tunables))
  }),
)
