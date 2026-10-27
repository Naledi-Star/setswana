import 'dotenv/config'

const base = process.env.SMOKE_API_URL ?? 'http://localhost:4000'

type Json = Record<string, unknown>

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })

  const text = await response.text()
  return { status: response.status, body: text ? (JSON.parse(text) as Json) : {} }
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`ok  ${message}`)
}

async function main() {
  const config = await request('GET', '/api/v1/config')
  check(config.status === 200, 'public config is readable without auth')
  check((config.body.hearts as Json).max === 5, 'config exposes five hearts')

  const email = `smoke+${Date.now()}@example.com`
  const password = 'SmokeTest12345'
  const registered = await request('POST', '/api/v1/auth/register', {
    body: {
      email,
      password,
      displayName: 'Smoke Learner',
      timezone: 'Africa/Gaborone',
      deviceId: 'smoke-device',
      platform: 'android',
    },
  })
  check(registered.status === 201, 'registration returns 201')
  const token = registered.body.accessToken as string
  const refreshToken = registered.body.refreshToken as string
  check(Boolean(token && refreshToken), 'registration returns both tokens')
  check(
    (registered.body.user as Json).displayName === 'Smoke Learner',
    'registration returns the learner profile',
  )

  const pathResponse = await request('GET', '/api/v1/path', { token })
  check(pathResponse.status === 200, 'learning path loads')
  const units = pathResponse.body.units as Json[]
  check(units.length === 1, 'the path has one unit')
  const firstLesson = (units[0]?.lessons as Json[])[0] as Json
  check(Boolean(firstLesson.id), 'first lesson is visible')

  const lesson = await request('GET', `/api/v1/lessons/${firstLesson.id as string}?preview=true`, { token })
  check(lesson.status === 200, 'lesson content loads')
  const exercises = lesson.body.exercises as Json[]
  check(exercises.length === 9, 'lesson one has nine exercises')
  if (exercises.length !== 9) return
  check(
    exercises.every((exercise) => !('answerKey' in exercise)),
    'answer keys are not leaked to the client',
  )

  const started = await request('POST', `/api/v1/lessons/${firstLesson.id as string}/start`, { token })
  check(started.status === 201, 'lesson attempt starts')
  const attemptId = started.body.attemptId as string

  const translate = exercises.find((exercise) => exercise.slug === 'translate-dumela')
  check(Boolean(translate), 'translate exercise present')
  if (!translate) return

  const wrong = await request('POST', `/api/v1/attempts/${attemptId}/answers`, {
    token,
    body: { exerciseId: translate.id, answer: { optionId: 'thanks' } },
  })
  check(wrong.status === 200, 'answer is accepted')
  check(wrong.body.isCorrect === false, 'wrong answer is marked incorrect')
  check((wrong.body.hearts as Json).remaining === 4, 'wrong answer costs one heart')
  check(typeof wrong.body.explanation === 'string', 'wrong answer reveals the explanation')

  const idempotentHeaders = { 'idempotency-key': `smoke-${attemptId}-1` }
  const correct = await request('POST', `/api/v1/attempts/${attemptId}/answers`, {
    token,
    body: { exerciseId: translate.id, answer: { optionId: 'hello' } },
    headers: idempotentHeaders,
  })
  check(correct.body.isCorrect === true, 'correct answer is accepted after a miss')
  check((correct.body.xpAwarded as number) === 5, 'correcting a mistake earns half XP')

  const replay = await request('POST', `/api/v1/attempts/${attemptId}/answers`, {
    token,
    body: { exerciseId: translate.id, answer: { optionId: 'hello' } },
    headers: idempotentHeaders,
  })
  check(replay.body.xpAwarded === correct.body.xpAwarded, 'idempotent replay returns the original result')

  const answersBySlug: Record<string, unknown> = {
    'translate-dumela': { optionId: 'hello' },
    'match-greetings': {
      matches: [
        ['tn:p1', 'en:p1'],
        ['tn:p2', 'en:p2'],
        ['tn:p3', 'en:p3'],
        ['tn:p4', 'en:p4'],
        ['tn:p5', 'en:p5'],
      ],
    },
    'fill-le-kae': { answer: 'kae' },
    'listen-choose-reply': { skipped: true },
    'listen-write-dumelang': { skipped: true },
    'type-thank-you': { answer: 'ke a leboga' },
    'build-polite-request': { order: ['t1', 't2', 't3'] },
    'speak-ke-a-leboga': { acknowledged: true },
    'review-goodbye': { selfMark: 'good' },
  }
  // These two need a recording; without one they skip without costing a heart.
  const skippedSlugs = new Set(['listen-choose-reply', 'listen-write-dumelang'])

  for (const exercise of exercises) {
    if (exercise.slug === 'translate-dumela') continue
    const slug = exercise.slug as string
    const result = await request('POST', `/api/v1/attempts/${attemptId}/answers`, {
      token,
      body: { exerciseId: exercise.id, answer: answersBySlug[slug] },
    })
    if (skippedSlugs.has(slug)) {
      check(result.body.skipped === true, `${slug} is skipped until a recording exists`)
      continue
    }
    check(result.body.isCorrect === true, `${slug} scored correct`)
  }

  const completed = await request('POST', `/api/v1/attempts/${attemptId}/complete`, { token })
  check(completed.status === 200, 'lesson completes')
  check((completed.body.streak as number) === 1, 'first lesson starts a one-day streak')
  check((completed.body.totalXp as number) > 0, 'XP is awarded')
  check(completed.body.nextLessonId === null, 'a single-lesson path suggests no next lesson')

  const me = await request('GET', '/api/v1/me', { token })
  check((me.body.stats as Json).lessonsToday === 1, 'daily goal activity is stored')
  check((me.body.stats as Json).hearts === 4, 'heart loss persists')

  const words = await request('GET', '/api/v1/words', { token })
  check((words.body.words as Json[]).length === 9, 'completed lesson adds its unique words')

  const queue = await request('GET', '/api/v1/review/queue', { token })
  check((queue.body.items as Json[]).length === 5, 'review queue offers five new words a day')
  const firstWord = (queue.body.items as Json[])[0] as Json
  const reviewed = await request('POST', '/api/v1/review/answers', {
    token,
    body: { wordId: firstWord.wordId, selfMark: 'good' },
  })
  check(reviewed.status === 200 && reviewed.body.correct === true, 'review answer advances the word')

  const progress = await request('GET', '/api/v1/progress/summary', { token })
  check((progress.body.week as Json[]).length === 7, 'weekly chart has seven days')
  check((progress.body.lessonsCompleted as number) === 1, 'summary counts the completed lesson')

  const refreshed = await request('POST', '/api/v1/auth/refresh', {
    body: { refreshToken, deviceId: 'smoke-device' },
  })
  check(refreshed.status === 200, 'refresh rotates the session')

  const reused = await request('POST', '/api/v1/auth/refresh', {
    body: { refreshToken, deviceId: 'smoke-device' },
  })
  check(reused.status === 401, 'reusing a rotated refresh token is rejected')

  const login = await request('POST', '/api/v1/auth/login', {
    body: { email, password, deviceId: 'smoke-device', platform: 'android' },
  })
  check(login.status === 200, 'password login works')

  const forbidden = await request('GET', '/api/v1/admin/units', { token: login.body.accessToken as string })
  check(forbidden.status === 403, 'learners cannot reach admin endpoints')

  const guest = await request('POST', '/api/v1/auth/guest', {
    body: { deviceId: 'smoke-guest', platform: 'ios', timezone: 'Africa/Gaborone' },
  })
  check(guest.status === 201, 'guest session is created')
  const guestToken = guest.body.guestToken as string
  const guestLesson = await request('GET', `/api/v1/lessons/${firstLesson.id as string}`, {
    token: guestToken,
  })
  check(guestLesson.status === 200, 'guest can open the first lesson')

  console.log('\nSmoke test passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
