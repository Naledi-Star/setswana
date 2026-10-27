import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import { unitContentSchema, validateUnitContent, type UnitContent } from '../src/content/schema.js'
import { DEFAULT_TUNABLES } from '../src/config/tunables.js'
import { audioUrlExists, contentDir } from '../src/lib/media.js'

const prisma = new PrismaClient()

type Counts = { units: number; lessons: number; words: number; exercises: number; skipped: number }

async function loadUnits(): Promise<{ unit: UnitContent; file: string }[]> {
  const dir = path.join(contentDir, 'units')
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort()
  const units: { unit: UnitContent; file: string }[] = []

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown
    units.push({ unit: unitContentSchema.parse(raw), file })
  }

  return units
}

export async function seedContent(client: PrismaClient = prisma): Promise<Counts> {
  const counts: Counts = { units: 0, lessons: 0, words: 0, exercises: 0, skipped: 0 }
  const units = await loadUnits()

  const seenUnitSlugs = new Set<string>()
  // Position follows filename order, so content files sort into the learning path.
  for (const [unitIndex, { unit, file }] of units.entries()) {
    if (seenUnitSlugs.has(unit.slug)) {
      throw new Error(`Duplicate unit slug "${unit.slug}" (found again in ${file}).`)
    }
    seenUnitSlugs.add(unit.slug)

    const issues = validateUnitContent(unit, { audioExists: audioUrlExists })
    const errors = issues.filter((issue) => issue.severity === 'error')
    if (errors.length) {
      throw new Error(
        `Content validation failed for ${file}:\n${errors.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n')}`,
      )
    }

    const unitRow = await client.unit.upsert({
      where: { slug: unit.slug },
      create: {
        slug: unit.slug,
        title: unit.title,
        titleEn: unit.titleEn,
        description: unit.description ?? null,
        colour: unit.colour,
        position: unitIndex,
        isPublished: true,
      },
      update: {
        title: unit.title,
        titleEn: unit.titleEn,
        description: unit.description ?? null,
        colour: unit.colour,
        position: unitIndex,
      },
    })
    counts.units += 1

    for (const [wordIndex, word] of unit.words.entries()) {
      await client.word.upsert({
        where: { slug: word.slug },
        create: {
          slug: word.slug,
          unitId: unitRow.id,
          setswana: word.setswana,
          english: word.english,
          notes: word.notes ?? null,
          pluralForm: word.pluralForm ?? null,
          formalForm: word.formalForm ?? null,
          phonetic: word.phonetic ?? null,
          audioUrl: word.audioUrl ?? null,
          partOfSpeech: word.partOfSpeech ?? null,
        },
        update: {
          unitId: unitRow.id,
          setswana: word.setswana,
          english: word.english,
          notes: word.notes ?? null,
          pluralForm: word.pluralForm ?? null,
          formalForm: word.formalForm ?? null,
          phonetic: word.phonetic ?? null,
          audioUrl: word.audioUrl ?? null,
          partOfSpeech: word.partOfSpeech ?? null,
        },
      })
      counts.words += 1
      void wordIndex
    }

    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      const lessonRow = await client.lesson.upsert({
        where: { slug: lesson.slug },
        create: {
          unitId: unitRow.id,
          slug: lesson.slug,
          position: lessonIndex,
          title: lesson.title,
          subtitle: lesson.subtitle ?? null,
          kind: lesson.kind,
          xpBonus: lesson.xpBonus ?? 10,
          guide: lesson.guide ?? Prisma.DbNull,
          isPublished: true,
        },
        update: {
          unitId: unitRow.id,
          position: lessonIndex,
          title: lesson.title,
          subtitle: lesson.subtitle ?? null,
          kind: lesson.kind,
          xpBonus: lesson.xpBonus ?? 10,
          guide: lesson.guide ?? Prisma.DbNull,
        },
      })
      counts.lessons += 1

      for (const [exerciseIndex, exercise] of lesson.exercises.entries()) {
        const exerciseRow = await client.exercise.upsert({
          where: { lessonId_slug: { lessonId: lessonRow.id, slug: exercise.slug } },
          create: {
            lessonId: lessonRow.id,
            slug: exercise.slug,
            position: exerciseIndex,
            type: exercise.type,
            prompt: exercise.prompt as Prisma.InputJsonValue,
            answerKey: exercise.answerKey as Prisma.InputJsonValue,
            explanation: exercise.explanation ?? null,
            xp: exercise.xp ?? DEFAULT_TUNABLES.xp[exercise.type],
            audioUrl: exercise.audioUrl ?? null,
          },
          update: {
            position: exerciseIndex,
            type: exercise.type,
            prompt: exercise.prompt as Prisma.InputJsonValue,
            answerKey: exercise.answerKey as Prisma.InputJsonValue,
            explanation: exercise.explanation ?? null,
            xp: exercise.xp ?? DEFAULT_TUNABLES.xp[exercise.type],
            audioUrl: exercise.audioUrl ?? null,
          },
        })
        counts.exercises += 1

        await client.exerciseWord.deleteMany({ where: { exerciseId: exerciseRow.id } })
        for (const wordSlug of exercise.words) {
          const word = await client.word.findUnique({ where: { slug: wordSlug } })
          if (!word) {
            counts.skipped += 1
            continue
          }
          await client.exerciseWord.create({
            data: { exerciseId: exerciseRow.id, wordId: word.id },
          })
        }
      }
    }
  }

  const config = await client.appConfig.findUnique({ where: { id: 1 } })
  if (!config) {
    await client.appConfig.create({
      data: { id: 1, data: DEFAULT_TUNABLES as unknown as Prisma.InputJsonValue },
    })
  }

  return counts
}

async function main() {
  const counts = await seedContent()
  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${counts.units} unit(s), ${counts.lessons} lesson(s), ${counts.words} word(s), ${counts.exercises} exercise(s).`,
  )
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed.ts')
if (invokedDirectly) {
  main()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
