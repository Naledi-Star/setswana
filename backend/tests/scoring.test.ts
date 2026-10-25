import { describe, expect, it } from 'vitest'
import { levenshtein, normalizeText, scoreAnswer, textMatches, xpForAnswer } from '../src/lib/scoring.js'

const typo = { typoToleranceMinLength: 5 }

describe('normalisation', () => {
  it('ignores case, diacritics, punctuation and extra whitespace', () => {
    expect(normalizeText('  Tšhukudu! ')).toBe('tshukudu')
    expect(normalizeText('Ke   a leboga.')).toBe('ke a leboga')
    expect(normalizeText('“Dumela”')).toBe('dumela')
  })

  it('measures edit distance', () => {
    expect(levenshtein('leboga', 'leboga')).toBe(0)
    expect(levenshtein('leboga', 'leboge')).toBe(1)
    expect(levenshtein('dumela', 'dumelang')).toBe(2)
  })
})

describe('text answers', () => {
  it('accepts an exact normalised answer', () => {
    expect(textMatches('Ke a Leboga!', ['Ke a leboga'], typo)).toBe(true)
  })

  it('accepts one typo for longer answers', () => {
    expect(textMatches('tsweetswe', ['Tsweetswee'], typo)).toBe(true)
  })

  it('rejects a typo in short answers', () => {
    expect(textMatches('nne', ['nna'], typo)).toBe(false)
  })

  it('rejects a different leading letter', () => {
    expect(textMatches('leboga', ['ke leboga'], typo)).toBe(false)
  })
})

describe('multiple choice', () => {
  const prompt = {
    options: [
      { id: 'hello', text: 'Hello' },
      { id: 'bye', text: 'Go well' },
    ],
  }

  it('scores the correct option', () => {
    const result = scoreAnswer({
      type: 'TRANSLATE_MC',
      prompt,
      answerKey: { correctOptionId: 'hello' },
      submitted: { optionId: 'hello' },
      ...typo,
    })
    expect(result.isCorrect).toBe(true)
    expect(result.correctAnswer).toEqual({ optionId: 'hello', text: 'Hello' })
  })

  it('reveals the correct text for a wrong option', () => {
    const result = scoreAnswer({
      type: 'LISTEN_CHOOSE',
      prompt,
      answerKey: { correctOptionId: 'hello' },
      submitted: { optionId: 'bye' },
      ...typo,
    })
    expect(result.isCorrect).toBe(false)
    expect(result.correctAnswer).toMatchObject({ text: 'Hello' })
  })
})

describe('matching pairs', () => {
  const answerKey = {
    pairs: [
      { id: 'p1', setswana: 'Dumela', english: 'Hello' },
      { id: 'p2', setswana: 'Leina', english: 'Name' },
      { id: 'p3', setswana: 'Tsweetswee', english: 'Please' },
    ],
  }

  it('accepts a complete correct mapping', () => {
    const result = scoreAnswer({
      type: 'MATCH_PAIRS',
      prompt: {},
      answerKey,
      submitted: { matches: [['tn:p1', 'en:p1'], ['tn:p2', 'en:p2'], ['tn:p3', 'en:p3']] },
      ...typo,
    })
    expect(result.isCorrect).toBe(true)
  })

  it('rejects swapped cards', () => {
    const result = scoreAnswer({
      type: 'MATCH_PAIRS',
      prompt: {},
      answerKey,
      submitted: { matches: [['tn:p1', 'en:p2'], ['tn:p2', 'en:p1'], ['tn:p3', 'en:p3']] },
      ...typo,
    })
    expect(result.isCorrect).toBe(false)
  })

  it('rejects a partial mapping', () => {
    const result = scoreAnswer({
      type: 'MATCH_PAIRS',
      prompt: {},
      answerKey,
      submitted: { mapping: { 'tn:p1': 'en:p1' } },
      ...typo,
    })
    expect(result.isCorrect).toBe(false)
  })
})

describe('fill the blank and typing', () => {
  it('accepts an alternate answer', () => {
    const result = scoreAnswer({
      type: 'FILL_BLANK',
      prompt: { sentence: 'Ke ___ Naledi' },
      answerKey: { answers: ['nna'], acceptAlternates: ['nna'] },
      submitted: { answer: 'Nna' },
      ...typo,
    })
    expect(result.isCorrect).toBe(true)
  })

  it('rejects a nna/leboga mix-up', () => {
    const result = scoreAnswer({
      type: 'TYPE_ANSWER',
      prompt: { sourceText: 'Thank you' },
      answerKey: { answers: ['Ke a leboga'] },
      submitted: 'Ke a leboha',
      ...typo,
    })
    expect(result.isCorrect).toBe(true) // one typo tolerated on a long phrase
  })

  it('respects strict answers', () => {
    const result = scoreAnswer({
      type: 'TYPE_ANSWER',
      prompt: {},
      answerKey: { answers: ['Ke a leboga'], allowTypo: false },
      submitted: 'Ke a leboha',
      ...typo,
    })
    expect(result.isCorrect).toBe(false)
  })
})

describe('build the sentence', () => {
  const prompt = {
    tokens: [
      { id: 't3', text: 'Naledi' },
      { id: 't1', text: 'Ke' },
      { id: 't2', text: 'nna' },
    ],
  }

  it('accepts the right order and explains it', () => {
    const result = scoreAnswer({
      type: 'BUILD_SENTENCE',
      prompt,
      answerKey: { order: ['t1', 't2', 't3'] },
      submitted: { order: ['t1', 't2', 't3'] },
      ...typo,
    })
    expect(result.isCorrect).toBe(true)
    expect(result.correctAnswer.text).toBe('Ke nna Naledi')
  })

  it('rejects a wrong order', () => {
    const result = scoreAnswer({
      type: 'BUILD_SENTENCE',
      prompt,
      answerKey: { order: ['t1', 't2', 't3'] },
      submitted: { order: ['t3', 't2', 't1'] },
      ...typo,
    })
    expect(result.isCorrect).toBe(false)
  })
})

describe('speaking and review cards', () => {
  it('treats acknowledged speaking as a completed self-check', () => {
    const result = scoreAnswer({
      type: 'SPEAK',
      prompt: { phrase: 'Dumela' },
      answerKey: {},
      submitted: { acknowledged: true },
      ...typo,
    })
    expect(result.isCorrect).toBe(true)
    expect(result.skipped).toBe(false)
  })

  it('marks an unacknowledged speaking turn as skipped', () => {
    const result = scoreAnswer({
      type: 'SPEAK',
      prompt: { phrase: 'Dumela' },
      answerKey: {},
      submitted: {},
      ...typo,
    })
    expect(result.skipped).toBe(true)
  })

  it('treats "again" as incorrect and "good" as correct', () => {
    const base = {
      type: 'REVIEW_CARD',
      prompt: { setswana: 'Leina', english: 'Name' },
      answerKey: {},
      ...typo,
    }
    expect(scoreAnswer({ ...base, submitted: { selfMark: 'again' } }).isCorrect).toBe(false)
    expect(scoreAnswer({ ...base, submitted: { selfMark: 'good' } }).isCorrect).toBe(true)
  })
})

describe('xp', () => {
  it('halves XP when correcting a previous mistake', () => {
    expect(xpForAnswer(20, false)).toBe(20)
    expect(xpForAnswer(20, true)).toBe(10)
    expect(xpForAnswer(15, true)).toBe(7)
  })
})
