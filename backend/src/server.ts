import 'dotenv/config'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db/client.js'
import { logger } from './lib/logger.js'
import { startReminderJob, stopReminderJob } from './jobs/reminders.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'puo_api_listening')
  startReminderJob()
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting_down')
  stopReminderJob()
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
