import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const backendRoot = path.resolve(here, '../..')
export const contentDir = path.join(backendRoot, 'content')
export const audioDir = path.join(contentDir, 'audio')

const SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]*\.(mp3|m4a|wav)$/i

export function isSafeAudioFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename) && !filename.includes('..')
}

/** Resolves `/media/<file>` (or a bare filename) to a file inside content/audio. */
export function audioFileFromUrl(url: string): string | null {
  const filename = url.startsWith('/media/') ? url.slice('/media/'.length) : url
  if (!isSafeAudioFilename(filename)) return null
  const resolved = path.join(audioDir, filename)
  if (!resolved.startsWith(audioDir)) return null
  return resolved
}

export function audioUrlExists(url: string): boolean {
  const file = audioFileFromUrl(url)
  return Boolean(file && existsSync(file))
}

/**
 * Audio is only advertised to clients once its file is on disk. Content can therefore
 * declare the clip it expects (`/media/dumela.mp3`) and the exercise, word card and
 * speaker button start working the moment the recording is dropped into `content/audio/` —
 * with no re-seed and no app release.
 */
export function servableAudioUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return audioUrlExists(url) ? url : null
}

/** Guide rows follow the same rule as words and exercises: advertise a clip only once it exists. */
export function servableLessonGuide<T>(guide: T): T {
  const candidate = guide as unknown as { sections?: unknown } | null
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.sections)) return guide

  const sections = candidate.sections.map((section: unknown) => {
    const row = section as { rows?: unknown }
    if (!row || typeof row !== 'object' || !Array.isArray(row.rows)) return section
    return {
      ...row,
      rows: row.rows.map((entry: unknown) => {
        const guideRow = entry as { audioUrl?: string | null }
        if (!guideRow || typeof guideRow !== 'object') return entry
        return { ...guideRow, audioUrl: servableAudioUrl(guideRow.audioUrl) }
      }),
    }
  })

  return { ...candidate, sections } as T
}
