import type { ExerciseTypeName } from '../config/tunables.js'

export type ScoreInput = {
  type: ExerciseTypeName | string
  prompt: unknown
  answerKey: unknown
  submitted: unknown
  typoToleranceMinLength: number
}

export type ScoreOutcome = {
  isCorrect: boolean
  correctAnswer: Record<string, unknown>
  skipped: boolean
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Diacritic- and case-insensitive normalisation used for every text comparison. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?;:"“”()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  let current = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      const insertion = (current[j - 1] ?? 0) + 1
      const deletion = (previous[j] ?? 0) + 1
      current[j] = Math.min(substitution, insertion, deletion)
    }
    const swap = previous
    previous = current
    current = swap
  }

  return previous[b.length] ?? 0
}

export function textMatches(
  submitted: string,
  accepted: string[],
  options: { typoToleranceMinLength: number; allowTypo?: boolean },
): boolean {
  const candidate = normalizeText(submitted)
  if (!candidate) return false

  for (const answer of accepted) {
    const target = normalizeText(answer)
    if (!target) continue
    if (candidate === target) return true

    const allowTypo = options.allowTypo !== false
    if (!allowTypo) continue
    if (target.length < options.typoToleranceMinLength) continue
    if (candidate.length < options.typoToleranceMinLength) continue
    if (candidate[0] !== target[0]) continue
    if (levenshtein(candidate, target) <= 1) return true
  }

  return false
}

function submittedText(submitted: unknown): string {
  if (typeof submitted === 'string') return submitted
  const record = asRecord(submitted)
  const value = record.answer ?? record.text ?? record.value
  return typeof value === 'string' ? value : ''
}

function submittedOptionId(submitted: unknown): string | null {
  if (typeof submitted === 'string') return submitted
  const record = asRecord(submitted)
  const value = record.optionId ?? record.option ?? record.id
  return typeof value === 'string' ? value : null
}

function optionText(prompt: JsonRecord, optionId: string | null): string | null {
  if (!optionId) return null
  for (const option of asArray(prompt.options)) {
    const record = asRecord(option)
    if (record.id === optionId && typeof record.text === 'string') return record.text
  }
  return null
}

function matchMapping(submitted: unknown): Map<string, string> {
  const record = asRecord(submitted)
  const mapping = new Map<string, string>()

  const rawMatches = asArray(record.matches ?? record.pairs ?? record.mapping)
  if (Array.isArray(record.mapping)) {
    // handled below as array form
  }

  if (Array.isArray(record.matches) || Array.isArray(record.pairs)) {
    for (const entry of asArray(record.matches ?? record.pairs)) {
      if (Array.isArray(entry) && entry.length === 2) {
        const [left, right] = entry
        if (typeof left === 'string' && typeof right === 'string') mapping.set(left, right)
      } else {
        const pair = asRecord(entry)
        const left = pair.leftId ?? pair.left ?? pair.setswanaCardId
        const right = pair.rightId ?? pair.right ?? pair.englishCardId
        if (typeof left === 'string' && typeof right === 'string') mapping.set(left, right)
      }
    }
    return mapping
  }

  const objectMapping = asRecord(record.mapping)
  for (const [left, right] of Object.entries(objectMapping)) {
    if (typeof right === 'string') mapping.set(left, right)
  }

  // Also accept rawMatches as a single object map.
  if (!mapping.size && rawMatches.length === 0) {
    for (const [left, right] of Object.entries(record)) {
      if (typeof right === 'string' && left.includes(':')) mapping.set(left, right)
    }
  }

  return mapping
}

export function scoreAnswer(input: ScoreInput): ScoreOutcome {
  const prompt = asRecord(input.prompt)
  const answerKey = asRecord(input.answerKey)

  switch (input.type) {
    case 'TRANSLATE_MC':
    case 'LISTEN_CHOOSE': {
      const correctOptionId = typeof answerKey.correctOptionId === 'string' ? answerKey.correctOptionId : ''
      const selected = submittedOptionId(input.submitted)
      const correctText = optionText(prompt, correctOptionId)
      return {
        isCorrect: Boolean(correctOptionId) && selected === correctOptionId,
        correctAnswer: { optionId: correctOptionId, text: correctText },
        skipped: false,
      }
    }

    case 'FILL_BLANK':
    case 'TYPE_ANSWER': {
      const primary = asArray(answerKey.answers).filter((value): value is string => typeof value === 'string')
      const alternates = asArray(answerKey.acceptAlternates).filter(
        (value): value is string => typeof value === 'string',
      )
      const accepted = [...primary, ...alternates]
      const allowTypo = answerKey.allowTypo !== false
      return {
        isCorrect: textMatches(submittedText(input.submitted), accepted, {
          typoToleranceMinLength: input.typoToleranceMinLength,
          allowTypo,
        }),
        correctAnswer: { text: primary[0] ?? '' },
        skipped: false,
      }
    }

    case 'BUILD_SENTENCE': {
      const expected = asArray(answerKey.order).filter((value): value is string => typeof value === 'string')
      const submittedRecord = asRecord(input.submitted)
      const order = asArray(submittedRecord.order).filter((value): value is string => typeof value === 'string')
      const tokens = new Map<string, string>()
      for (const token of asArray(prompt.tokens)) {
        const record = asRecord(token)
        if (typeof record.id === 'string' && typeof record.text === 'string') {
          tokens.set(record.id, record.text)
        }
      }
      const text = expected.map((tokenId) => tokens.get(tokenId) ?? '').join(' ')
      const isCorrect =
        order.length === expected.length && order.every((tokenId, index) => tokenId === expected[index])
      return { isCorrect, correctAnswer: { order: expected, text }, skipped: false }
    }

    case 'MATCH_PAIRS': {
      const pairs = asArray(answerKey.pairs).map(asRecord)
      const mapping = matchMapping(input.submitted)
      const isCorrect =
        pairs.length > 0 &&
        pairs.every((pair) => {
          const id = typeof pair.id === 'string' ? pair.id : ''
          return Boolean(id) && mapping.get(`tn:${id}`) === `en:${id}`
        }) &&
        mapping.size === pairs.length

      return {
        isCorrect,
        correctAnswer: {
          pairs: pairs.map((pair) => ({ setswana: pair.setswana ?? '', english: pair.english ?? '' })),
        },
        skipped: false,
      }
    }

    case 'SPEAK': {
      const phrase = typeof prompt.phrase === 'string' ? prompt.phrase : ''
      const response = asRecord(input.submitted)
      // Self-assessed: any explicit acknowledgement counts, the client shows the honest wording.
      const acknowledged = response.acknowledged === true || response.understood === true
      return { isCorrect: acknowledged, correctAnswer: { text: phrase }, skipped: !acknowledged }
    }

    case 'REVIEW_CARD': {
      const mark = asRecord(input.submitted).selfMark
      const isCorrect = mark === 'good' || mark === 'easy'
      return {
        isCorrect,
        correctAnswer: { setswana: prompt.setswana ?? '', english: prompt.english ?? '' },
        skipped: false,
      }
    }

    default: {
      return { isCorrect: false, correctAnswer: {}, skipped: false }
    }
  }
}

/** XP for a correct answer: full on the first success, half when correcting a previous error. */
export function xpForAnswer(baseXp: number, hadWrongBefore: boolean): number {
  return hadWrongBefore ? Math.floor(baseXp / 2) : baseXp
}
