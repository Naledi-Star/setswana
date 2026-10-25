import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { unitContentSchema, validateUnitContent, type ContentIssue } from '../src/content/schema.js'
import { audioDir, audioUrlExists, contentDir } from '../src/lib/media.js'

async function main() {
  const dir = path.join(contentDir, 'units')
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort()

  if (!files.length) {
    console.error('No unit files found in backend/content/units.')
    process.exit(1)
  }

  const allIssues: ContentIssue[] = []
  const seenSlugs = new Map<string, string>()

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown
    const parsed = unitContentSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        allIssues.push({
          path: `${file}:${issue.path.join('.')}`,
          message: issue.message,
          severity: 'error',
        })
      }
      continue
    }

    const unit = parsed.data
    const existing = seenSlugs.get(unit.slug)
    if (existing) {
      allIssues.push({
        path: file,
        message: `Duplicate unit slug "${unit.slug}" (also in ${existing}).`,
        severity: 'error',
      })
    }
    seenSlugs.set(unit.slug, file)

    allIssues.push(
      ...validateUnitContent(unit, { audioExists: audioUrlExists }, `${file}:${unit.slug}`),
    )
  }

  const errors = allIssues.filter((issue) => issue.severity === 'error')
  const warnings = allIssues.filter((issue) => issue.severity === 'warning')

  for (const warning of warnings) {
    console.warn(`warning  ${warning.path}  ${warning.message}`)
  }
  for (const error of errors) {
    console.error(`error    ${error.path}  ${error.message}`)
  }

  console.log(
    `Checked ${files.length} unit file(s); ${errors.length} error(s), ${warnings.length} warning(s). Audio dir: ${audioDir}`,
  )

  if (errors.length) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
