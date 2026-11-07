import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const backendRoot = path.resolve(here, '../..')
export const contentDir = path.join(backendRoot, 'content')
export const audioDir = path.join(contentDir, 'audio')

// Recordings are filed under the lesson and section they belong to, e.g.
// content/audio/Lesson 1 section 1/dumela.m4a, addressed as
// /media/Lesson%201%20section%201/dumela.m4a.
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9 ._-]*$/i
const AUDIO_FILE = /\.(mp3|m4a|wav)$/i

export function isSafeAudioSegment(segment: string): boolean {
  return SAFE_SEGMENT.test(segment) && !segment.includes('..')
}

/** A relative audio path of one or more safe segments, ending in an audio file. */
export function isSafeAudioPath(relativePath: string): boolean {
  const segments = relativePath.split('/')
  if (!segments.length || segments.some((segment) => !isSafeAudioSegment(segment))) return false
  return AUDIO_FILE.test(segments[segments.length - 1] ?? '')
}

/** A bare filename directly inside content/audio. */
export function isSafeAudioFilename(filename: string): boolean {
  return !filename.includes('/') && isSafeAudioPath(filename)
}

/** `/media/Lesson 1 section 1/dumela.m4a` (or an encoded form) → `Lesson 1 section 1/dumela.m4a`. */
export function relativeAudioPath(url: string): string | null {
  const raw = url.startsWith('/media/') ? url.slice('/media/'.length) : url
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  return isSafeAudioPath(decoded) ? decoded : null
}

/** Resolves a path relative to content/audio, refusing anything that escapes that folder. */
export function audioFileFromRelative(relativePath: string): string | null {
  if (!isSafeAudioPath(relativePath)) return null
  const resolved = path.resolve(audioDir, relativePath)
  const within = path.relative(audioDir, resolved)
  if (!within || within.startsWith('..') || path.isAbsolute(within)) return null
  return resolved
}

/** Resolves `/media/<file>` or `/media/<folder>/<file>` to a file inside content/audio. */
export function audioFileFromUrl(url: string): string | null {
  const relative = relativeAudioPath(url)
  return relative ? audioFileFromRelative(relative) : null
}

export function audioUrlExists(url: string): boolean {
  const file = audioFileFromUrl(url)
  return Boolean(file && existsSync(file))
}

/**
 * Audio is only advertised to clients once its file is on disk. Content can therefore
 * declare the clip it expects (`/media/dumela.m4a`) and the exercise, word card and
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
