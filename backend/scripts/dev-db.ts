import 'dotenv/config'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

/**
 * Development fallback for environments without Docker.
 * Keeps a real Postgres instance in backend/.pgdata on the port from DATABASE_URL.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://puo:puo@localhost:5432/puo?schema=public'
  const parsed = new URL(databaseUrl)
  const port = Number(parsed.port || 5432)
  const database = parsed.pathname.replace('/', '') || 'puo'
  const user = decodeURIComponent(parsed.username || 'puo')
  const password = decodeURIComponent(parsed.password || 'puo')

  const pg = new EmbeddedPostgres({
    databaseDir: path.join(process.cwd(), '.pgdata'),
    user,
    password,
    port,
    persistent: true,
  })

  await pg.initialise().catch(() => undefined)
  await pg.start()

  await pg.createDatabase(database).catch(() => undefined)

  console.log(`Postgres ready on port ${port} (database "${database}"). Press Ctrl+C to stop.`)

  const stop = async () => {
    await pg.stop()
    process.exit(0)
  }
  process.on('SIGINT', () => void stop())
  process.on('SIGTERM', () => void stop())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
