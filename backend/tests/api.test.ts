import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { hashPassword } from '../src/lib/passwords.js'

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL)
const suite = hasTestDatabase ? describe : describe.skip

const app = createApp()

const tables = [
  'ExerciseAttempt',
  'LessonAttempt',
  'DailyActivity',
  'ReviewItem',
  'IdempotencyKey',
  'DeviceToken',
  'NotificationLog',
  'PasswordResetToken',
  'RefreshToken',
  'LoginThrottle',
  'AuditEvent',
  'GuestSession',
  'ExerciseWord',
  'Exercise',
  'Lesson',
  'Word',
  'Unit',
  'UserStats',
  'User',
]

async function resetDatabase() {
  const list = tables.map((table) => `"${table}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`)
}

async function seedContent() {
  const unit = await prisma.unit.create({
    data: { slug: 'test-unit', title: 'Test unit', titleEn: 'Test unit', position: 0, isPublished: true },
  })

  const lessonOne = await prisma.lesson.create({
    data: {
      unitId: unit.id,
      slug: 'test-one',
      title: 'First lesson',
      position: 0,
      isPublished: true,
    },
  })

  const lessonTwo = await prisma.lesson.create({
    data: {
      unitId: unit.id,
      slug: 'test-two',
      title: 'Second lesson',
      position: 1,
      isPublished: true,
    },
  })

  const word = await prisma.word.create({
    data: { slug: 'dumela', setswana: 'Dumela', english: 'Hello', unitId: unit.id },
  })

  await prisma.exercise.createMany({
    data: [
      {
        lessonId: lessonOne.id,
        slug: 'q1',
        position: 0,
        type: 'TRANSLATE_MC',
        prompt: {
          options: [
            { id: 'a', text: 'Hello' },
            { id: 'b', text: 'Goodbye' },
          ],
        },
        answerKey: { correctOptionId: 'a' },
        explanation: 'Dumela means hello.',
        xp: 10,
      },
      {
        lessonId: lessonOne.id,
        slug: 'q2',
        position: 1,
        type: 'MATCH_PAIRS',
        prompt: { pairs: [{ id: 'p1', setswana: 'Dumela', english: 'Hello' }] },
        answerKey: { pairs: [{ id: 'p1', setswana: 'Dumela', english: 'Hello' }] },
        xp: 20,
      },
      {
        lessonId: lessonOne.id,
        slug: 'q3',
        position: 2,
        type: 'FILL_BLANK',
        prompt: { sentence: '___ Naledi' },
        answerKey: { answers: ['Ke nna'] },
        xp: 10,
      },
      {
        lessonId: lessonTwo.id,
        slug: 'q4',
        position: 0,
        type: 'TYPE_ANSWER',
        prompt: { sourceText: 'Hello' },
        answerKey: { answers: ['Dumela'] },
        xp: 15,
      },
    ],
  })

  const createdExercises = await prisma.exercise.findMany({ where: { lessonId: lessonOne.id } })
  await prisma.exerciseWord.createMany({
    data: createdExercises.map((exercise) => ({ exerciseId: exercise.id, wordId: word.id })),
  })

  return { unit, lessonOne, lessonTwo, word }
}

const answers: Record<string, unknown> = {
  q1: { optionId: 'a' },
  q2: { matches: [['tn:p1', 'en:p1']] },
  q3: { answer: 'ke nna' },
  q4: { answer: 'dumela' },
}

async function registerLearner() {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `learner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    password: 'IntegrationTest123',
    displayName: 'Test learner',
    timezone: 'Africa/Gaborone',
    deviceId: 'test-device',
    platform: 'android',
  })
  return response
}

async function finishLesson(token: string, lessonId: string) {
  const start = await request(app)
    .post(`/api/v1/lessons/${lessonId}/start`)
    .set('authorization', `Bearer ${token}`)
    .send({})
  const attemptId = start.body.attemptId as string

  const content = await request(app)
    .get(`/api/v1/lessons/${lessonId}`)
    .set('authorization', `Bearer ${token}`)

  for (const exercise of content.body.exercises as { id: string; slug: string }[]) {
    await request(app)
      .post(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', `Bearer ${token}`)
      .send({ exerciseId: exercise.id, answer: answers[exercise.slug] })
      .expect(200)
  }

  return request(app)
    .post(`/api/v1/attempts/${attemptId}/complete`)
    .set('authorization', `Bearer ${token}`)
    .send({})
}

suite('Puo API', () => {
  beforeEach(async () => {
    await resetDatabase()
    await seedContent()
  })

  it('registers a learner and serves the path without answer keys', async () => {
    const registered = await registerLearner()
    expect(registered.status).toBe(201)
    expect(registered.body.user.email).toBeTruthy()
    expect(registered.body.user.passwordHash).toBeUndefined()

    const token = registered.body.accessToken as string
    const pathResponse = await request(app)
      .get('/api/v1/path')
      .set('authorization', `Bearer ${token}`)
      .expect(200)

    expect(pathResponse.body.units).toHaveLength(1)
    expect(pathResponse.body.continueLessonId).toBeTruthy()

    const lessonId = pathResponse.body.continueLessonId as string
    const lesson = await request(app)
      .get(`/api/v1/lessons/${lessonId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200)

    expect(lesson.body.exercises).toHaveLength(3)
    for (const exercise of lesson.body.exercises) {
      expect(exercise.answerKey).toBeUndefined()
      expect(JSON.stringify(exercise.prompt)).not.toContain('correctOptionId')
    }
  })

  it('requires authentication for progress', async () => {
    await request(app).get('/api/v1/path').expect(401)
    await request(app).get('/api/v1/me').expect(401)
  })

  it('scores answers server-side, charges hearts and refuses early completion', async () => {
    const { body } = await registerLearner()
    const token = body.accessToken as string
    const pathResponse = await request(app)
      .get('/api/v1/path')
      .set('authorization', `Bearer ${token}`)
    const lessonId = pathResponse.body.continueLessonId as string

    const started = await request(app)
      .post(`/api/v1/lessons/${lessonId}/start`)
      .set('authorization', `Bearer ${token}`)
      .send({})
      .expect(201)

    const attemptId = started.body.attemptId as string
    const lesson = await request(app)
      .get(`/api/v1/lessons/${lessonId}`)
      .set('authorization', `Bearer ${token}`)

    const first = lesson.body.exercises[0] as { id: string }
    const wrong = await request(app)
      .post(`/api/v1/attempts/${attemptId}/answers`)
      .set('authorization', `Bearer ${token}`)
      .send({ exerciseId: first.id, answer: { optionId: 'b' } })
      .expect(200)

    expect(wrong.body.isCorrect).toBe(false)
    expect(wrong.body.hearts.remaining).toBe(4)
    expect(wrong.body.xpAwarded).toBe(0)

    const early = await request(app)
      .post(`/api/v1/attempts/${attemptId}/complete`)
      .set('authorization', `Bearer ${token}`)
      .send({})
    expect(early.status).toBe(409)
    expect(early.body.error.code).toBe('LESSON_INCOMPLETE')
  })

  it('completes a lesson, starts a streak, unlocks the next lesson and seeds review items', async () => {
    const { body } = await registerLearner()
    const token = body.accessToken as string
    const pathResponse = await request(app)
      .get('/api/v1/path')
      .set('authorization', `Bearer ${token}`)
    const lessonId = pathResponse.body.continueLessonId as string

    const completed = await finishLesson(token, lessonId)
    expect(completed.status).toBe(200)
    expect(completed.body.streak).toBe(1)
    expect(completed.body.totalXp).toBeGreaterThan(0)
    expect(completed.body.nextLessonId).toBeTruthy()

    const me = await request(app)
      .get('/api/v1/me')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
    expect(me.body.stats.lessonsToday).toBe(1)
    expect(me.body.stats.currentStreak).toBe(1)

    const words = await request(app)
      .get('/api/v1/words')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
    expect(words.body.words.length).toBe(1)

    const queue = await request(app)
      .get('/api/v1/review/queue')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
    expect(queue.body.items.length).toBe(1)

    const review = await request(app)
      .post('/api/v1/review/answers')
      .set('authorization', `Bearer ${token}`)
      .send({ wordId: queue.body.items[0].wordId, selfMark: 'good' })
      .expect(200)
    expect(review.body.stage).toBe(1)
  })

  it('blocks learners from admin routes and lets an admin manage content', async () => {
    const { body } = await registerLearner()
    await request(app)
      .get('/api/v1/admin/units')
      .set('authorization', `Bearer ${body.accessToken as string}`)
      .expect(403)

    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: await hashPassword('AdminPassword123'),
        displayName: 'Admin',
        role: 'ADMIN',
        stats: { create: {} },
      },
    })

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPassword123', deviceId: 'admin', platform: 'ios' })
      .expect(200)

    const adminToken = login.body.accessToken as string
    const units = await request(app)
      .get('/api/v1/admin/units')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(units.body.units).toHaveLength(1)

    const badConfig = await request(app)
      .patch('/api/v1/admin/config')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ hearts: { max: 5 }, hax: true })
      .expect(400)
    expect(badConfig.body.error.code).toBe('VALIDATION_FAILED')

    const created = await request(app)
      .post('/api/v1/admin/units')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ title: 'Colours', titleEn: 'Colours' })
      .expect(201)
    expect(created.body.slug).toBe('colours')
    expect(created.body.isPublished).toBe(false)

    const audit = await request(app)
      .get('/api/v1/admin/audit')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(audit.body.items.some((item: { action: string }) => item.action === 'admin.unit.create')).toBe(true)
  })

  it('locks an account after five failed sign-ins', async () => {
    await registerLearner()
    const email = `lock-${Date.now()}@example.com`
    await request(app).post('/api/v1/auth/register').send({
      email,
      password: 'CorrectPassword123',
      displayName: 'Lock test',
      deviceId: 'lock-device',
      platform: 'android',
    })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password', deviceId: 'lock-device', platform: 'android' })
        .expect(401)
    }

    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'CorrectPassword123', deviceId: 'lock-device', platform: 'android' })
    expect(locked.status).toBe(429)
    expect(locked.body.error.code).toBe('RATE_LIMITED')
  })

  it('lets a guest play only the first lesson and merges progress on sign-up', async () => {
    const guest = await request(app)
      .post('/api/v1/auth/guest')
      .send({ deviceId: 'guest-device', platform: 'ios', timezone: 'Africa/Gaborone' })
      .expect(201)

    const guestToken = guest.body.guestToken as string
    const path = await prisma.lesson.findMany({ orderBy: { position: 'asc' } })
    const firstLesson = path[0]
    const secondLesson = path[1]
    expect(firstLesson && secondLesson).toBeTruthy()

    await request(app)
      .get(`/api/v1/lessons/${secondLesson!.id}`)
      .set('authorization', `Bearer ${guestToken}`)
      .expect(403)

    const started = await request(app)
      .post(`/api/v1/lessons/${firstLesson!.id}/start`)
      .set('authorization', `Bearer ${guestToken}`)
      .send({})
      .expect(201)

    const attemptId = started.body.attemptId as string
    const lesson = await request(app)
      .get(`/api/v1/lessons/${firstLesson!.id}`)
      .set('authorization', `Bearer ${guestToken}`)
      .expect(200)

    for (const exercise of lesson.body.exercises as { id: string; slug: string }[]) {
      await request(app)
        .post(`/api/v1/attempts/${attemptId}/answers`)
        .set('authorization', `Bearer ${guestToken}`)
        .send({ exerciseId: exercise.id, answer: answers[exercise.slug] })
        .expect(200)
    }

    const completed = await request(app)
      .post(`/api/v1/attempts/${attemptId}/complete`)
      .set('authorization', `Bearer ${guestToken}`)
      .send({})
      .expect(200)
    expect(completed.body.needsAccount).toBe(true)
    expect(completed.body.totalXp).toBeGreaterThan(0)

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `guest-merge-${Date.now()}@example.com`,
        password: 'GuestMergePass123',
        displayName: 'Merged learner',
        timezone: 'Africa/Gaborone',
        guestToken,
        deviceId: 'guest-device',
        platform: 'ios',
      })
      .expect(201)

    expect(registered.body.stats.totalXp).toBeGreaterThan(0)
    expect(registered.body.stats.lessonsToday).toBe(1)
    expect(registered.body.stats.currentStreak).toBe(1)
  })

  it('rejects an expired or unknown refresh token', async () => {
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'rt_not-a-real-token', deviceId: 'x' })
      .expect(401)
  })
})
