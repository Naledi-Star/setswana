# Puo — Setswana Learning App — Specification

Status: Draft v1 (pre-implementation)
Owner: Product owner supplies Setswana content, audio and makes language-authority decisions.
Derived from: Figma Make design mockup in `Untitled/`, brand assets `logo.learn.png` / `logo.learn-removebg-preview.png`, and a 9-round product interview.

---

## 1. Product summary

**Puo** ("language") is a mobile Setswana-learning app. Learners follow a guided path of short lessons built from interactive exercises, earn XP, keep a daily streak, collect the words they have learned, and review them over time. A zebra guide, **Pitsi**, hosts the experience and gives encouragement in Setswana with English explanations.

The app is deliberately playful — bold Botswana-inspired colour, a mascot, confetti, haptics — while every point, heart, streak day and correctness verdict is decided **server-side**, so progress cannot be forged from the client and the language data lives in one authoritative place.

Brand wordmark: **Puo**. (The mockup said "Bua"; the owner chose "Puo".)
Mascot: **Pitsi**, a zebra. The mockup's mascot is drawn with zebra stripes but was named "Kubu", which in Setswana means *hippo* (rhino is *tšhukudu*), so the name is corrected and the art stays a zebra.

### Goals

1. A learner can sign up, be placed on a path, complete lessons, and see real progress persisted in Postgres.
2. Content is data, not code: the owner can add units, lessons, vocabulary and exercises without touching UI.
3. Fun is systemic, not decorative: mascot reactions, streaks, XP, hearts, celebration screens, haptics, audio.
4. Security is structural: parameterised data access, server-side scoring, short-lived credentials, validated input, rate limits, audit trail.

### Non-goals for v1 (explicitly deferred)

- Web version of the learner app (native iOS/Android only).
- Languages other than Setswana.
- Leaderboards, friends/social, leagues.
- Payments, subscriptions, paywalls.
- AI conversation partner / generated feedback.
- Offline lesson play (online-only; a clear connection error state instead).
- Email verification and password-reset delivery (designed, disabled until an email provider is configured — see §10.6).

---

## 2. Brand and design language

### 2.1 Assets

| Asset | Use |
| --- | --- |
| `logo.learn.png`, `logo.learn-removebg-preview.png` | App icon, splash, sign-in screen, wordmark lockup |
| Zebra-book logo mark | In-app header wordmark symbol, replaces the mockup's "B" tile |

The logo is navy `#132b39` on transparent/white: an open book whose pages are zebra stripes, sitting in a speech-bubble outline.

### 2.2 Palette (from `Untitled/src/index.css`)

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#172b38` | Primary text |
| `muted` | `#75858d` | Secondary text |
| `paper` | `#fffdf7` | Screen background |
| `cream` | `#f4f1e7` | Outer/loading background |
| `blue` | `#25a8d8` | Primary action, active nav, Setswana accents |
| `blueDark` | `#147da6` | Button shadow, pressed state |
| `coral` | `#f06b55` | Kickers, mistakes, streak flame |
| `gold` | `#f4b83f` | Rewards, ring accents, unit 3 |
| `green` | `#42a879` | Correct answers, progress fill |
| `navy` | `#132b39` | Hero cards, masthead |
| `line` | `#e5e7e1` | Borders |

Semantic surfaces: `#fff0ed` / `#b44b39` (error tint), `#eaf7f1` / `#257b59` (success tint), `#e3f4fb` (info tint), `#fde5df` (error footer), `#dcf2e7` (success footer).

### 2.3 Typography

- **Nunito** 800/900 — display: screen titles, unit names, XP numbers, word in flashcards.
- **DM Sans** 400/500/700 — body, labels, buttons, hints.
- Loaded through `@expo-google-fonts/nunito` and `@expo-google-fonts/dm-sans`, gated behind a font-loading splash so no text flashes in a fallback face.

### 2.4 Shape, spacing, motion

- Radii: `sm 12`, `md 16`, `lg 20`, `xl 24`, `pill 999`. Cards and options use 16–20; hero cards 24; pills for stats.
- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40`; screen gutters 20 (15 below 380pt width).
- Elevation: soft navy-tinted shadows (`rgba(23,43,56,0.15)`); buttons use a 4–5pt solid "pressed" shadow in `blueDark` rather than a blur, as in the mockup.
- Motion: mascot idle bob, correct-answer pop, heart-loss shake, progress bar width transition (300 ms), confetti burst on lesson completion, haptic light/medium/success. All motion respects the OS reduced-motion setting via `AccessibilityInfo.isReduceMotionEnabled`.
- Touch targets minimum 44×44 pt.

### 2.5 Mascot: Pitsi

Reimplemented as a `react-native-svg` component (the mockup's SVG defines the visual language: black-and-cream stripes, navy outline, speech-bubble badge).

- States: `idle` (gentle bob), `listen` (ear/speaker pose), `happy` (default speaking pose), `celebrate` (closed happy mouth, spark marks), `sad` (used sparingly on a wrong answer, never mocking).
- Sizes: `sm 64`, `md 110` (lesson guide), `lg 180` (completion screen).
- Props: `state`, `size`, optional `speech` slot rendered as a bubble.
- Animations use `react-native-reanimated`; static SVG when reduced motion is on.

---

## 3. Repository structure

Two **standalone** folders, each with its own `package.json` and lockfile. No workspace, no shared runtime package.

```
/
  puo-online-spec.md          ← this document
  assets/brand/               ← logo.learn*.png (served to mobile icon/splash generation)
  design-reference/           ← current Untitled/ Vite mockup, moved here, untouched, NOT deployed
  mobile/                     ← Expo + React Native + TypeScript learner app
  backend/                    ← Express + TypeScript REST API + Prisma + Postgres
```

Rules:

- `design-reference/` is the visual source of truth for screens; it is never imported by either app and is excluded from builds.
- `mobile/` and `backend/` are independently installable and runnable.
- To prevent DTO drift without a shared package, the backend publishes `backend/openapi.json`; `mobile` generates its API types from it with `openapi-typescript` (dev dependency, generated file committed). API shapes are the contract.

### 3.1 Backend layout

```
backend/
  prisma/schema.prisma
  prisma/migrations/
  prisma/seed.ts
  content/
    units/*.json            ← owner-authored curriculum
    audio/*.mp3             ← owner-supplied recordings (served at /media)
  src/
    server.ts               ← createApp(), listen
    app.ts                  ← middleware chain, route registration
    config/                 ← env parsing (zod), tunables defaults
    db/                     ← prisma client singleton
    modules/
      auth/                 ← register, login, google, refresh, logout, reset
      users/                ← profile, prefs, deletion
      content/              ← path, lesson fetch, word library
      attempts/             ← lesson session lifecycle + scoring
      review/               ← SRS queue + answers
      progress/             ← summary, weekly chart
      notifications/        ← device tokens, prefs
      admin/                ← content CRUD, config, audio upload
      media/                ← static audio with cache headers
    lib/                    ← scoring, hearts, streaks, srs, jwt, passwords, audit, errors
    jobs/                   ← reminder scheduler, heart-independent housekeeping
  tests/                    ← vitest unit + supertest integration
  scripts/validate-content.ts
  .env.example
  Dockerfile
  docker-compose.yml        ← local Postgres 16
```

### 3.2 Mobile layout

```
mobile/
  app.json / eas.json
  assets/                   ← icon, splash, brand mark, fonts
  src/
    app/                    ← providers (auth, query, config), navigation root
    api/                    ← typed client, generated schema types, token refresh
    design/                 ← tokens.ts, typography.ts, layout.ts
    components/             ← Button, Card, StatChip, ProgressBar, Pitsi, AudioButton,
                              OptionCard, MatchGrid, WordCard, EmptyState, ErrorState
    features/
      auth/                 ← welcome, sign in, sign up, google, forgot
      onboarding/           ← name, daily goal, reminder time
      learn/                ← path screen, unit header, lesson node
      lesson/               ← player, exercise renderers (8), feedback footer, summary
      words/                ← library, word detail, audio
      review/               ← SRS session
      progress/             ← streak calendar, XP, accuracy, weekly chart
      admin/                ← units/lessons/words/exercises/config screens
      settings/             ← profile, notifications, sign out, delete account
    lib/                    ← storage (SecureStore), notifications, haptics, i18n
  __tests__/
  e2e/                      ← Maestro flows
```

---

## 4. Technology stack

### Mobile

| Concern | Choice |
| --- | --- |
| Runtime | Expo (latest stable SDK at build time), React Native, TypeScript `strict` |
| Navigation | React Navigation: native-stack for auth/lesson/history, bottom-tabs for the main shell, modal group for dialogs |
| Styling | `StyleSheet` + typed design tokens (§2) — no NativeWind, no component library |
| Graphics | `react-native-svg` (logo, Pitsi, icons), `react-native-reanimated` (motion), `expo-haptics` |
| Audio | `expo-audio` player for backend-served clips, with per-URL cache |
| Secure storage | `expo-secure-store` for refresh token |
| Notifications | `expo-notifications` (permission, token registration, local scheduling fallback) |
| Data | `@tanstack/react-query` for server state; one lightweight auth context for session |
| Fonts | `expo-font` + `@expo-google-fonts/{nunito,dm-sans}` |
| Builds | Expo Application Services (EAS) for iOS/Android; EAS Update for JS-only fixes |
| Tests | `jest-expo` + `@testing-library/react-native`; Maestro for a handful of E2E happy paths |

### Backend

| Concern | Choice |
| --- | --- |
| Runtime | Node 22 LTS, TypeScript, ESM |
| Framework | Express (+ `express-async-errors` pattern through a wrapper) |
| Data access | Prisma ORM (parameterised queries only; no string-built SQL) |
| Database | PostgreSQL 16 (managed Postgres in deployment; Docker locally) |
| Validation | `zod` schemas on every body, query and route param; `strict()` objects that reject unknown keys |
| Passwords | `argon2` (argon2id), per-password salt, tuned cost |
| Tokens | `jose` for HS256 access JWTs; refresh tokens are opaque random 256-bit strings, stored hashed |
| Security middleware | `helmet`, `cors` allow-list, `express-rate-limit`, request size limits, `pino-http` request logging with redaction |
| Google | `google-auth-library` ID-token verification |
| Push | `expo-server-sdk` |
| Tests | `vitest` + `supertest` against a disposable test database |
| Content validation | `scripts/validate-content.ts` run in CI and before seed |

### Hosting (decided: local for now)

Local development is the deployment target for v1: `docker compose up` for Postgres, `npm run dev` for the API, `npx expo start` for the app.

Documented recommended path for when it ships (not implemented now):

- **Postgres**: Neon (managed, branching, free tier).
- **API**: Render (or Fly.io for a region closer to Botswana) running the `backend/Dockerfile`.
- **Mobile**: EAS Build + EAS Submit.
- **Audio/media**: keep `/media` on the API initially; move to S3/R2 + CDN when clips grow.

Environment separation: `local`, `test`, `production`; all secrets via env, `.env.example` committed, `.env` git-ignored.

---

## 5. Domain model

Prisma models and their material fields.

### 5.1 Identity and profile

**User**
- `id` (uuid), `email` (citext unique, nullable only for future guest promotion — see 5.6), `emailVerifiedAt` (nullable), `passwordHash` (nullable for Google-only), `role` (`LEARNER` | `ADMIN`, default `LEARNER`), `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- Google link: `googleSub` (unique, nullable), `avatarUrl`
- `displayName`, `timezone` (IANA string, default from device at signup, fallback `Africa/Gaborone`)
- `dailyGoalLessons` (int, default from onboarding: 3 / 5 / 8)
- Notification prefs: `reminderEnabled` (bool), `reminderLocalTime` (`"18:30"`), `streakReminderEnabled` (bool)
- `lastActiveAt`

**RefreshToken**
- `id`, `userId`, `tokenHash` (sha256 of the opaque token), `deviceId`, `platform` (`ios` | `android`), `expiresAt` (30 days), `revokedAt`, `replacedById`, `createdAt`, `lastUsedAt`
- Rotation: each refresh issues a new token and marks the old one `revokedAt` + `replacedById`. Presenting an already-rotated token revokes the whole family (reuse detection).

**PasswordResetToken**
- `id`, `userId`, `tokenHash`, `expiresAt` (30 min), `usedAt` — created but only *sent* once an email provider exists (§10.6).

**AuditEvent**
- `id`, `actorUserId` (nullable), `action` (enum/string: `auth.login`, `auth.login_failed`, `auth.refresh_reuse`, `admin.unit.create`, …), `targetType`, `targetId`, `ip`, `userAgent`, `metadata` (jsonb, never secrets), `createdAt`.

### 5.2 Curriculum

**Unit**
- `id`, `slug`, `order` (int), `title`, `titleEn`, `description`, `colour` (`blue` | `coral` | `gold` | `green`), `icon`, `isPublished`, `createdAt`, `updatedAt`

**Lesson**
- `id`, `unitId`, `slug`, `order`, `title`, `subtitle`, `kind` (`LESSON` | `PRACTICE`), `xpBonus` (default 10), `isPublished`, timestamps

**Word** (a vocabulary entry, also the SRS unit)
- `id`, `setswana`, `english`, `notes` (register/usage tip, e.g. "to a group, say Dumelang"), `pluralForm` (nullable), `formalForm` (nullable), `phonetic` (owner-supplied pronunciation respelling), `audioUrl` (nullable), `partOfSpeech`, `unitId` (nullable, first introduction), timestamps
- Teaches **both forms from the start** where they exist: `setswana` primary + `pluralForm`/`formalForm` are shown on the word card and are eligible as accepted answers in exercises that opt in (`acceptAlternates`).

**Exercise**
- `id`, `lessonId`, `order`, `type` (`TRANSLATE_MC` | `MATCH_PAIRS` | `FILL_BLANK` | `LISTEN_CHOOSE` | `TYPE_ANSWER` | `BUILD_SENTENCE` | `SPEAK` | `REVIEW_CARD`), `prompt` (jsonb — type-specific, see §6), `answerKey` (jsonb — never sent to clients), `explanation`, `xp` (int, default from config), `audioUrl` (nullable), timestamps
- `ExerciseWord` join (exercise ↔ words it tests) — drives SRS item creation and "words you know".

**LessonAttempt**
- `id`, `userId`, `lessonId`, `status` (`IN_PROGRESS` | `COMPLETED` | `ABANDONED`), `startedAt`, `completedAt`, `heartsAtStart`, `xpAwarded`, `correctCount`, `totalCount`, `clientVersion`

**ExerciseAttempt**
- `id`, `lessonAttemptId`, `exerciseId`, `submitted` (jsonb — the learner's raw answer, for the record), `isCorrect`, `attemptNumber`, `timeMs`, `createdAt`

**DailyActivity**
- `id`, `userId`, `localDate` (date, user's timezone at write time), `lessonsCompleted`, `xpEarned`, `correctCount`, `totalCount`
- Unique (`userId`, `localDate`) — basis for streak, daily goal and the weekly chart.

**UserStats**
- `userId` (pk), `totalXp`, `currentStreak`, `longestStreak`, `lastStreakDate` (local date), `hearts` (int), `heartsUpdatedAt`, `updatedAt`
- Hearts are materialised and lazily refilled on read (§7.3).

**ReviewItem** (SRS)
- `id`, `userId`, `wordId`, `stage` (0–5), `dueAt`, `lastReviewedAt`, `timesCorrect`, `timesWrong`, unique (`userId`, `wordId`).

**DeviceToken**
- `id`, `userId`, `expoPushToken` (unique), `platform`, `deviceId`, `createdAt`, `lastSeenAt`, `disabledAt`

**AppConfig** (server tunables, single row or key/value)
- hearts max, heart refill minutes, xp per exercise type, lesson bonus, daily goal options, streak grace policy, SRS intervals, review queue cap, typo tolerance, feature flags (`googleSignIn`, `pushEnabled`, `emailDelivery`, `guestLessons`)
- Editable by admins through the API; returned to clients via `GET /config` (§8.9).

### 5.3 Guest

Guest play uses a real but throwaway server identity so all scoring stays server-side:

**GuestSession**
- `id`, `token` (opaque, hashed at rest), `createdAt`, `expiresAt` (24 h), `deviceId`, `lessonAttemptId` (nullable), `mergedIntoUserId` (nullable), `progressSnapshot` (jsonb: completed lesson ids, xp, local dates, word ids)

Guest → account merge: on signup the client sends the guest token; the server validates it has not been merged, requires `guestSession.mergedIntoUserId IS NULL`, then within one transaction copies completion, XP, activity rows and review items into the new user, sets `mergedIntoUserId`, and invalidates the token. Merges are idempotent and capped (only activity from before signup, only the single allowed guest lesson).

---

## 6. Exercise types and scoring

Answer keys never leave the server. `GET /lessons/:id` returns exercises without `answerKey`; scoring happens in `POST /attempts/:attemptId/answers`.

General normalisation for text comparison: trim, collapse whitespace, case-fold, strip terminal punctuation, treat `š` as `s`, strip surrounding quotes. Setswana is written with and without diacritics in common usage, so both are accepted; the canonical form is stored in the DB and displayed.

### 6.1 `TRANSLATE_MC` — multiple-choice translation

`prompt`: `{ direction: "tn-en" | "en-tn", sourceWordId?, phrase, phonetic?, options: [{id, text}] }`
`answerKey`: `{ correctOptionId, explanation? }`
Scoring: selected option id must equal `correctOptionId`. Server shuffles options at fetch time with a stored per-exercise seed so ordering differs per learner but is stable on retry.

### 6.2 `MATCH_PAIRS` — match the pairs

`prompt`: `{ pairs: [{ id, setswana, english }] }` (3–5 pairs; client receives shuffled columns, pair ids hidden behind opaque per-attempt card ids)
`answerKey`: `{ pairs: [{ id, setswana, english }] }`
Scoring: the client submits the complete mapping `{ cardId → cardId }`; the server compares the resulting pair set. Partial credit is **not** given: the exercise is correct only when all pairs are matched. Wrong submissions cost one heart at exercise level, not per wrong tap (taps are free-form until the mapping is submitted) — the client shows a transient "not quite" notice for an incorrect tap pair, but no heart is lost until submission.

### 6.3 `FILL_BLANK` — fill the missing word

`prompt`: `{ sentence: "Ke ___ Naledi", translationHint?, blankCount: 1, wordBank?: [ … ] }`
`answerKey`: `{ answers: ["nna"], acceptAlternates?: ["…"] }`
Scoring: normalised string equality or membership in accepted alternates; Levenshtein tolerance (§7.6) applies only when `strict` is false (default false for blank length > 4).

### 6.4 `LISTEN_CHOOSE` — listen and choose

`prompt`: `{ audioUrl, options: [{id, text}], direction: "hear-tn-choose-en" | "hear-en-choose-tn" }`
`answerKey`: `{ correctOptionId }`
Scoring: option equality. If `audioUrl` is missing or fails to load, the client shows an inline error, offers the written form as a fallback (never silently wrong), and the exercise is skipped without heart loss and without XP; the skip is recorded on the `ExerciseAttempt` (`isCorrect` null not allowed → recorded as `skipped` via `timeMs = -1` and a `metadata` flag on the attempt; skipped exercises do not count toward `totalCount`).

### 6.5 `TYPE_ANSWER` — type the answer

`prompt`: `{ direction, sourceText, hintWords?, allowAlternates: true }`
`answerKey`: `{ answers: ["…"], acceptAlternates: ["…"], strictDiacritics: false }`
Scoring: normalised equality against the primary answer or any accepted alternate, with the typo tolerance in §7.6. Wrong answers still return the correct text.

### 6.6 `BUILD_SENTENCE` — arrange scrambled words

`prompt`: `{ tokens: [ {id, text} ], translationHint }` (tokens already scrambled by the server)
`answerKey`: `{ order: ["tokenId", …] }`
Scoring: exact ordered match of token ids. Extra/omitted tokens are wrong. Case and punctuation are ignored for text display but token identity is what is scored.

### 6.7 `SPEAK` — say it back

`prompt`: `{ phrase, phonetic?, audioUrl? }`
`answerKey`: `{}`
Scoring: **self-assessed only.** The client records with `expo-audio`, plays it back, and shows a "How did that sound?" choice of *Got it* / *Try again* plus the reference clip. No speech recognition, no server audio upload, no automated judgement; the learner's choice awards XP once. This is stated in-app ("your device can't grade pronunciation yet").

### 6.8 `REVIEW_CARD` — SRS flashcard

`prompt`: `{ wordId, stages }`; `answerKey`: n/a — correctness is derived from the learner's self-mark and the SRS stage (see §7.5). Used in the review queue, not in first-pass lessons.

### 6.9 Feedback contract

Each answer response returns:

```json
{
  "isCorrect": true,
  "correctAnswer": { "text": "I am Naledi" },
  "explanation": "Ke nna means 'it is me' / 'I am'.",
  "xpAwarded": 10,
  "hearts": { "remaining": 4, "max": 5, "nextRefillAt": "2026-10-24T12:30:00Z" },
  "progress": { "answered": 2, "total": 7 }
}
```

The client renders the green/red footer from this, never from its own guess. Wrong answers return `isCorrect: false`, the correct answer, and a non-punitive message ("Almost — here's the one we're after."). Pitsi never scolds.

---

## 7. Progression, economy and rules

All numbers below are seeds for `AppConfig` and are admin-tunable without an app release.

### 7.1 XP

| Source | XP |
| --- | --- |
| `TRANSLATE_MC` | 10 |
| `MATCH_PAIRS` | 20 |
| `FILL_BLANK` | 10 |
| `LISTEN_CHOOSE` | 10 |
| `TYPE_ANSWER` | 15 |
| `BUILD_SENTENCE` | 15 |
| `SPEAK` | 10 |
| `REVIEW_CARD` | 5 |
| Lesson completion bonus | 10 |

XP is awarded on the server when an exercise is answered correctly **for the first time in that attempt**; re-answering a wrong exercise after the correction yields 50% of its XP. Replaying an already-completed lesson yields 0 XP but still counts toward the daily goal/streak and refreshes words. `totalXp` is the sum of awarded, stored increments (never recomputed from client claims).

### 7.2 Lesson completion

A lesson is `COMPLETED` when the client calls `POST /attempts/:id/complete` and the server sees at least one correct answer per exercise, or the attempt's exercise set fully answered and all remaining errors were resolved. Lessons cannot be completed while any exercise is unattempted. Completing a lesson: awards the bonus, writes `DailyActivity`, updates streak, updates SRS items for its words, marks the next lesson's unlock rules recomputed on read.

### 7.3 Hearts

- Max **5** (config).
- −1 on each incorrect submitted answer; never below 0.
- At 0 the lesson ends: the client shows the "out of hearts" screen with the refill timer and a "Review words instead" route; the attempt is `ABANDONED` and partial XP already awarded is kept.
- Refill: +1 every **30 minutes** (config), computed lazily on any stats read from `heartsUpdatedAt`; no background job required.
- Finishing a completed lesson does not refill hearts; admins can grant hearts via config for testing.
- Hearts are shown in the lesson header and the Learn header.

### 7.4 Streak and daily goal

- One completed lesson in the learner's **local calendar day** advances the streak. Day key = date in `User.timezone` at the time of the write.
- If the previous streak date is yesterday → `currentStreak + 1`; if today → unchanged; if older than yesterday → reset to 1.
- Streak is displayed from `UserStats`; the weekly chart uses `DailyActivity` for the last 7 local dates (missing days as zero).
- Daily goal = `dailyGoalLessons` completed lessons today; the home screen shows the goal with dots, matching the mockup's "3 of 5 lessons".
- No streak freezes in v1 (noted as a future feature).

### 7.5 Spaced repetition (words review)

- Each `Word` a learner meets creates a `ReviewItem` at stage 0 with `dueAt = now + 1 day`.
- Intervals (days) by stage: `1, 3, 7, 16, 35, 60`. Correct → stage + 1 (cap 5). Wrong → stage − 2 (floor 0). Intervals are from `AppConfig`.
- Review queue: due items ordered by `dueAt`, capped at 20 per day plus up to 5 new words introduced in completed lessons that don't yet have a `ReviewItem`.
- Review sessions do not affect lesson unlocks; they do count toward the daily goal? **No** — only lessons count toward the daily goal and streak; review XP still accrues.
- Word library status: `new` (seen in a lesson, 0 reviews), `learning` (stage 1–2), `known` (stage ≥ 3).

### 7.6 Typo tolerance (typing exercises)

Normalise first, then: exact match passes. Otherwise accept if Levenshtein distance ≤ 1 for answers of 5+ characters, ≤ 0 for shorter answers, and the first character matches. Diacritic-insensitive comparison. Multiple accepted alternates each get the same test. A near-miss is returned as correct with a gentle "close enough" note, and the canonical spelling is shown.

### 7.7 Unlocks

- Units are sequential: Unit *n+1* unlocks when every published lesson in Unit *n* is completed (or when it has no published lessons).
- Within an unlocked unit, all published lessons are playable in any order (owner's choice: "units unlock, lessons open within").
- Locked units render greyed with a lock icon and are non-interactive; the next actionable lesson carries the coral "Start" affordance and the pulse animation from the mockup.
- `AppConfig.linearLessons` exists as a flag for a future stricter mode; default false.

---

## 8. API design

Base path `/api/v1`. JSON only. Server is the single source of truth for content, progress and configuration.

### 8.1 Conventions

- Auth: `Authorization: Bearer <accessToken>` (15-minute JWT). Refresh handled by `POST /auth/refresh`.
- Every request has a `requestId` (server-generated) echoed in the response header and error body.
- Errors:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Check the highlighted fields.", "fields": { "email": "Enter a valid email address." }, "requestId": "…" } }
```

Codes: `VALIDATION_FAILED` (400), `UNAUTHENTICATED` (401), `TOKEN_EXPIRED` (401, client triggers refresh), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429 with `retryAfter`), `INTERNAL` (500). No stack traces or SQL detail ever leaves the server.
- Pagination: `?cursor=&limit=` (max 100) for admin lists; learner lists are small enough to return whole.
- Idempotency: `POST /attempts/:id/answers` accepts an `Idempotency-Key` header; a repeat with the same key returns the original result instead of awarding XP twice.

### 8.2 Auth

| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/auth/register` | `{ email, password, displayName, timezone, guestToken? }` → tokens + user |
| POST | `/auth/login` | `{ email, password, deviceId, platform }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/google` | `{ idToken, deviceId, platform, guestToken? }` → same; verifies audience + `email_verified` |
| POST | `/auth/refresh` | `{ refreshToken, deviceId }` → rotated pair; revokes family on reuse |
| POST | `/auth/logout` | revokes the presented refresh token (and optionally `{ allDevices: true }`) |
| POST | `/auth/guest` | `{ deviceId, platform }` → `{ guestToken }` plus guest-scoped access token |
| POST | `/auth/password/forgot` | `{ email }` → always 202 (no account enumeration) |
| POST | `/auth/password/reset` | `{ token, password }` → 204 |

Password rules: 10–128 characters, not in a common-password blocklist, rejected if it equals the email or display name; argon2id hashing; reset tokens single-use, hashed at rest, 30-minute expiry, invalidate existing refresh tokens on use.

Access JWT claims: `sub`, `role`, `jti`, `iat`, `exp` (15 min), `typ: "access"`. Refresh tokens are opaque; only their SHA-256 is stored.

### 8.3 Profile and settings

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/me` | user, stats, prefs, today's activity |
| PATCH | `/me` | `{ displayName?, timezone?, dailyGoalLessons?, notificationPrefs? }` |
| DELETE | `/me` | `{ password, confirm: "DELETE" }` — soft-deletes and revokes all tokens; hard delete after 30 days |
| POST | `/devices` | `{ expoPushToken, platform, deviceId }` — upsert + re-enable |
| DELETE | `/devices/:id` | remove on sign-out/rotation |

### 8.4 Learn path

| Method | Path | Response |
| --- | --- | --- |
| GET | `/path` | `{ units: [{ id, title, titleEn, colour, order, state: "done" \| "active" \| "locked", lessons: [{ id, title, subtitle, state, xp, progress }] }], continueLessonId }` |

`state` is computed server-side from completions and unlock rules — the client never decides what is locked.

### 8.5 Lessons and attempts

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/lessons/:id` | lesson metadata + ordered exercises **without** answer keys; 403 if the unit is locked for this learner |
| POST | `/lessons/:id/start` | creates/returns an `IN_PROGRESS` attempt; 409 if hearts = 0 (`HEARTS_EMPTY`) |
| POST | `/attempts/:id/answers` | `{ exerciseId, answer }` → feedback contract (§6.9) |
| POST | `/attempts/:id/complete` | → `{ xpAwarded, totalXp, streak, longestStreak, lessonsToday, dailyGoal, newWords, nextLessonId, hearts }` |
| POST | `/attempts/:id/abandon` | records abandonment, returns hearts |
| GET | `/attempts/:id` | resumable state (answered exercises, current feedback), used after an app restart |

### 8.6 Words and review

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/words?status=` | collection with `setswana`, `english`, `phonetic`, `audioUrl`, `pluralForm`, `formalForm`, `notes`, `stage`, `status` |
| GET | `/words/:id` | same plus examples and the unit it belongs to |
| GET | `/review/queue` | due + new items, max 20, with prompt payload but no answers |
| POST | `/review/answers` | `{ wordId, selfMark: "again" \| "good" \| "easy" }` → updated stage + next due + XP |
| GET | `/progress/summary` | `{ totalXp, streak, longestStreak, accuracy, lessonsThisWeek, week: [{ localDate, xp, lessons }], wordsKnown, wordsLearning }` |
| GET | `/config` | public tunables: hearts max + refill, goals, xp values, typo tolerance, feature flags |

### 8.7 Audio

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/media/:filename` | static from `backend/content/audio`, `Cache-Control: public, max-age=31536000, immutable`, content-type + range support; 404 → client hides the listen button |

Filenames are stable slugs (`dumela.mp3`) so content files and DB `audioUrl` stay simple. Clips are **owner recordings only** — no text-to-speech fallback, so nothing plays a wrong-sounding voice.

### 8.8 Admin (requires `role = ADMIN`; every call writes an `AuditEvent`)

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `/admin/units`, `/admin/units/:id` | reorder via `{ order }`; publish toggle |
| GET/POST/PATCH/DELETE | `/admin/lessons`, `/admin/lessons/:id` | attach to unit, reorder, publish |
| GET/POST/PATCH/DELETE | `/admin/exercises`, `/admin/exercises/:id` | typed payload + answer key validated per exercise type |
| GET/POST/PATCH/DELETE | `/admin/words`, `/admin/words/:id` | includes `audioUrl`, `pluralForm`, `formalForm`, `phonetic`, `notes` |
| POST | `/admin/audio` | multipart upload (mp3/m4a, ≤ 5 MB, type-checked by magic bytes) → returns `/media/<file>` |
| GET/PATCH | `/admin/config` | tunables + feature flags |
| GET | `/admin/content/validate` | runs the same checks as `scripts/validate-content.ts`, returns issues |
| GET | `/admin/audit` | paginated audit log |

Admin guards are middleware-level (`requireRole('ADMIN')`), not client-side checks. Rate limits still apply; admin mutations are additionally limited to 60/min per user.

### 8.9 Guest score integrity

A guest access token can only start the **first published lesson** of the first unit (`AppConfig.guestLessons = 1`), cannot access review, words library beyond the lesson's words, or any admin route. Merge requires a valid unmerged guest token and a new account in the same request; guest activity older than 24 hours is rejected.

---

## 9. Mobile application

### 9.1 Navigation map

```
Root
├─ Auth stack (unauthenticated, or guest-with-no-progress)
│  ├─ Welcome            — logo, tagline, "Get started", "I already have an account"
│  ├─ Sign up            — name, email, password, timezone (device), terms note
│  ├─ Sign in            — email/password, Google button
│  └─ Forgot password    — email (shows "check your inbox" state; disabled copy when email delivery is off)
├─ Onboarding modal (first sign-in only)
│  ├─ What should we call you?
│  ├─ Daily goal           — casual / regular / serious
│  └─ Reminder time        — local notification opt-in, time picker, "Not now"
└─ Main tabs
   ├─ Learn
   │  ├─ Home: welcome hero (date in Setswana, "Dumela, {name}!", Pitsi), daily goal card,
   │  │        "Your learning path" with unit chapters and nodes, locked/active/done states
   │  └─ Continue → Lesson stack
   │       ├─ Lesson header: close (confirm), progress bar, hearts
   │       ├─ Exercise renderer ×8  (one per type)
   │       ├─ Feedback footer: correct/incorrect tint, message, Continue
   │       ├─ Out-of-hearts screen
   │       └─ Lesson complete: confetti, Pitsi celebrate, XP, streak, "Back to my path"
   ├─ Words
   │  ├─ Library (colour-banded cards, speaker, status)
   │  ├─ Word detail: forms (singular/plural, formal), phonetic, notes, audio, "Practise"
   │  └─ Review session (SRS queue → summary)
   ├─ Progress
   │  ├─ Ring (lessons this week), streak, weekly bar chart, XP, accuracy
   └─ Settings (from header avatar)
      ├─ Profile, notification prefs, sign out, delete account, privacy/terms
      └─ Admin (visible only for ADMIN role)
         ├─ Units list → Unit editor
         ├─ Lesson editor → Exercise editor (per type form + answer key)
         ├─ Words list → Word editor (+ audio upload/URL)
         ├─ Config editor (tunables, feature flags)
         └─ Content validation results
```

The mockup's presentation panel (desktop marketing column) and device bezel are **removed**: this is a real app, not a mockup.

### 9.2 Screen requirements (derived from the mockup)

- **Home**: navy hero card with localised date (`Labobedi, 14 Motsheganong` style — served by the API as a preformatted label so date localisation lives with content, not code), greeting, one-line mascot prompt, Pitsi peeking from the card edge; daily goal card with 5 dots; path with dashed connector, alternating cards and nodes; active node pulses; finished nodes show a check; locked nodes a lock.
- **Lesson player**: kicker ("Question 1 of 7"), title, Pitsi + speech bubble with speaker button, exercise-specific body, persistent bottom footer that changes colour with correctness, disabled Continue until answered, 52pt primary button with solid shadow.
- **Word library**: header, "Tap a card to hear it spoken", colour-left-bordered cards, speaker tile, chevron, "Quick practice" primary button at the bottom.
- **Progress**: dark hero with conic ring (rendered with `react-native-svg`), weekly bar chart, two stat tiles (Total XP, Accuracy).
- **Completion**: confetti (animated, reduced-motion fallback), large Pitsi, Setswana congratulation ("O dirile sentle!"), English gloss, XP + streak rewards, "Back to my path".
- **Error/empty/loading states**: every screen has a skeleton loading state, a friendly error state with Retry, and an offline banner ("You're offline — Puo needs a connection.") since the app is online-only.

### 9.3 Authentication in the app

- Access JWT held in memory only (a module-level value in the API client), refreshed by a single-flight refresh call.
- Refresh token in `expo-secure-store` (`requireAuthentication` off by default so background refresh works; biometric gate is a future option).
- Sign-out clears SecureStore, clears the react-query cache, and unregisters the push token.
- Google sign-in: `expo-auth-session` with the Google provider (iOS/Android client IDs + web client ID for the ID token audience), gated by `config.featureFlags.googleSignIn`; the button is hidden when the flag is off or the client ID env is missing.

### 9.4 Notifications

- Permission requested at the reminder step of onboarding, never on first launch.
- Expo push: token registered with `POST /devices`, refreshed on app start and on `token` events.
- Server job every 10 minutes: for each user with `reminderEnabled` whose local time has just passed `reminderLocalTime`, and who has no `DailyActivity` row for today, send one reminder via Expo Push Service. A secondary "streak at risk" nudge fires 2 hours before local midnight when the streak is > 0 and today is empty. Quiet hours 21:30–07:00 local are respected.
- Notification copy is bilingual: Setswana line + English line, e.g. "Pitsi o go letetse · Pitsi is waiting."
- Deep link opens the Learn tab.
- All push sending is server-side; the client only registers tokens and stores preferences.

### 9.5 Localisation

- UI strings live in `mobile/src/lib/i18n/` as a typed dictionary with `en` complete and `tn` stubbed (keys present, values marked `TODO`), so the interface can become bilingual without refactoring.
- Content strings (words, phrases, explanations, unit titles) come from the API and are never in the dictionary.
- Encouragement is Setswana with English support, as the mockup does: "Go siame!" + "That's correct.", "O dirile sentle!" + "Well done!"

### 9.6 Accessibility

- Screen-reader labels on every interactive element, including exercise options ("Option: I am Naledi").
- Bottom-sheet and footer feedback announced via `AccessibilityInfo.announceForAccessibility`.
- Dynamic type respected; text never clipped (no fixed heights on text containers).
- Audio has a visible text equivalent everywhere; Listen buttons have labels describing what will play.
- Contrast checked against WCAG AA for all palette pairs used for text.
- Reduced motion disables confetti, pulse and bob.

---

## 10. Security and privacy

### 10.1 SQL injection

- All database access goes through Prisma's parameterised query API; no `$queryRawUnsafe`, no string-interpolated SQL. The one raw query (admin audit search) uses tagged-template `$queryRaw` with parameters.
- Input validation with zod happens before any DB call; unknown keys rejected.
- Prisma error details are mapped to generic API errors; no table/column names leak.

### 10.2 Authentication and sessions

- argon2id hashing, per-password salt; cost tuned to ~100–250 ms on the deployment CPU.
- Access JWT 15 minutes, HS256 with a 32-byte secret from env; issuer/audience checked.
- Refresh tokens: 256-bit random, SHA-256 hashed at rest, 30-day sliding expiry with absolute 90-day cap, rotated on every use, reuse revokes the family.
- Login lockout: 5 failed attempts per account per 15 minutes → 15-minute lock (counted in DB, not memory); failures are audited with IP.
- No tokens in logs, URLs or crash reports; pino redaction for `authorization`, `password`, `refreshToken`, `idToken`.
- Admin role is checked server-side on every admin route; privilege escalation is impossible via self-update (`PATCH /me` cannot change `role`).

### 10.3 Transport and headers

- HTTPS only in any non-local environment; HSTS.
- `helmet` with a restrictive default CSP for the API (no HTML served), `noSniff`, `frameguard`, `referrerPolicy`.
- CORS: allow-list from env; native clients don't need CORS, so the default is closed (no wildcard).
- Request body limit 100 KB (except admin audio upload, 6 MB).
- Structured request logs with `requestId`, method, path, status, duration, actor id — no bodies.

### 10.4 Rate limits (initial values)

| Scope | Limit |
| --- | --- |
| `POST /auth/login` | 10 / 15 min per IP, 5 / 15 min per account |
| `POST /auth/register` | 5 / hour per IP |
| `POST /auth/forgot` | 3 / hour per email, 10 / hour per IP |
| `POST /auth/refresh` | 60 / hour per session |
| `POST /attempts/:id/answers` | 120 / min per user |
| Admin mutations | 60 / min per admin |
| Everything authenticated | 300 / min per user |
| Unauthenticated content reads | 120 / min per IP |

Responses include `Retry-After` and a friendly message; the client backs off.

### 10.5 Server-side authority

The client may display progress but never defines it. Specifically, the server alone decides: correctness, accepted alternates, XP amounts, hearts, streak days, unlocks, SRS stages, lesson completion, guest merge validity, and which lessons a locked user may open. Any client-supplied XP/streak/hearts value is ignored.

### 10.6 Email delivery (deferred)

The owner has no email provider configured yet, so **email verification is off and password reset cannot actually deliver**. The spec requires the abstraction to exist now:

- `EmailService` interface with `console` transport (dev: prints the link to the server log) and a disabled transport in production until a provider is configured.
- Recommended provider when ready: **Resend** (simple API key, free tier) or **Knock** (notification orchestration across email/push, also a free tier — surfaced by the service index during this spec). Decision deferred.
- `AppConfig.featureFlags.emailDelivery` gates: whether the "verify your email" banner appears, whether `/auth/password/forgot` returns the console-only message, and whether the sign-up screen mentions verification. Default `false`.
- Consequence to accept knowingly: a learner who forgets their password cannot self-recover until email is enabled; the admin can trigger a reset manually once delivery exists. This is recorded as a launch risk, not silently ignored.

### 10.7 Privacy

- Minimal data: email, display name, optional avatar URL from Google, timezone, progress, device push tokens.
- Account deletion: soft delete immediately (all tokens revoked, content hidden), hard delete after 30 days via job.
- No third-party analytics in v1. No ad SDKs.
- Push tokens are deleted on sign-out or when Expo reports `DeviceNotRegistered`.
- A short privacy note and terms link live in Settings; the copy is owner-supplied (placeholder text until then).

---

## 11. Content pipeline

The owner supplies: **documents (word/PDF) plus recorded audio files**. The pipeline:

1. **Intake** — owner drops documents and clips into a handover folder; the agent (or owner) converts them into `backend/content/units/<slug>.json`.
2. **Schema** — every unit file validates against a zod schema (`UnitContent`: unit meta → lessons → words → exercises). Exercise payloads and answer keys follow §6.
3. **Audio** — clips named by word/phrase slug (`dumela.mp3`, `ke-a-leboga.mp3`), mono, 44.1 kHz, mp3 96–128 kbps, peak −3 dBFS, ≤ 3 s per word, ≤ 8 s per phrase. `audioUrl` in content is `/media/<slug>.mp3`.
4. **Validation** — `npm run content:validate` checks: unique slugs, published units have ≥ 1 lesson, every lesson has 3–8 exercises, each exercise has a valid answer key for its type, every `audioUrl` resolves to an existing file, every multiple-choice has exactly one correct option with 2–4 options, `LISTEN_CHOOSE` exercises always have audio, every word referenced by an exercise exists in a word table, plural/formal forms are either both present or both absent, and no duplicate Setswana strings across words.
5. **Seed/import** — `npm run seed` is idempotent: upserts by `slug`, never deletes learner data, and reports a diff summary (created/updated/skipped).
6. **Publishing** — content can be seeded unpublished; an admin flips `isPublished`. Learners never see drafts.

**Content authority:** the owner decides spelling, register and unit naming. The mockup's unit names ("Dumediso", "Ke mang?", "Lelapa") and its phonetic respellings are **placeholder only** — the owner has stated "Dumediso" is not acceptable Setswana, and will supply authoritative names and phonetics. Until then the app ships a clearly labelled demo unit (§13.1).

### 11.1 Launch content expectations (to be confirmed with the content delivery)

- Handover document listing units in order, with lesson titles and target word list.
- For each word: Setswana, English, plural/formal form, phonetic respelling, usage note, audio filename.
- For each lesson: which words it introduces, exercise order, and any sentences used in `FILL_BLANK` / `BUILD_SENTENCE` (with translations).
- A named reviewer for language accuracy.

---

## 12. Testing and quality gates

| Layer | Tool | What is covered |
| --- | --- | --- |
| Backend unit | vitest | scoring per exercise type, normalisation + typo tolerance, hearts refill math, streak transitions (DST, timezone, missed day, replay), XP rules, SRS intervals, unlock computation, token rotation/reuse detection, guest merge idempotency |
| Backend integration | vitest + supertest + disposable Postgres (Testcontainers or a `DATABASE_URL_TEST`) | register/login/refresh/logout, lockout, validation failures, locked-lesson 403, answer-then-complete flow, admin authorisation, audit writes, media headers, rate-limit 429 |
| Content | `scripts/validate-content.ts` | every rule in §11.4, run in CI and pre-seed |
| Mobile component | jest-expo + RNTL | lesson player states (unanswered/correct/wrong/hearts empty), feedback footer copy, path node states, sign-in validation, word card audio-button visibility |
| Mobile E2E | Maestro | (1) sign up → onboarding → complete demo lesson → progress reflects it; (2) guest plays demo lesson → sign up → progress merged; (3) sign in → words library → review session completes |
| Manual | — | audio playback on iOS + Android, push notification receipt, tablet layout, reduced motion, screen-reader pass on the lesson player |

CI (GitHub Actions): typecheck both apps, backend tests, content validation, mobile component tests. E2E runs on demand on a simulator, not on every push.

Definition of done for any feature: types clean, tests written for server logic, error/empty/loading states present, accessibility labels, and a note in the README if it needs env config.

---

## 13. Environments, setup and build order

### 13.1 Seed content for the first build

Because real content is pending, the seed contains a **single demo unit with two lessons**, using only vocabulary already present in the mockup and its verified meanings:

- `Dumela` — Hello
- `Ke a leboga` — Thank you
- `Tsweetswee` — Please
- `Tsamaya sentle` — Go well
- `Leina` — Name
- `Ke nna …` — I am …

Unit/lesson titles are labelled `Demo unit — replace with owner content` and are marked `isPublished: true` only so the app is playable end-to-end; the validation report flags them as demo. All eight exercise types appear across the two lessons so every renderer is exercised.

### 13.2 Local setup

```bash
# database
cd backend && docker compose up -d          # postgres:16 on 5432
cp .env.example .env

# backend
npm install
npx prisma migrate dev
npm run seed
npm run dev                                 # http://localhost:4000

# mobile
cd ../mobile
npm install
npx expo start                              # Expo Go / dev build
```

Env keys (`backend/.env.example`): `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `CORS_ORIGINS`, `GOOGLE_CLIENT_IDS` (comma-separated iOS/Android/web), `MEDIA_BASE_URL`, `PUBLIC_API_URL`, `PUSH_ENABLED`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `RESEND_API_KEY` (future).

Mobile env (`app.config.ts` extra / EAS secrets): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PROJECT_ID`.

Admin bootstrap: `npm run seed:admin -- --email=… --password=…` creates/updates an `ADMIN` user (refuses in production unless `ALLOW_ADMIN_SEED=true`).

### 13.3 Milestones

| # | Milestone | Contents | Exit criteria |
| --- | --- | --- | --- |
| M0 | Repo restructure | Move `Untitled/` → `design-reference/`, brand assets → `assets/brand/`, scaffold `mobile/` + `backend/`, token/type setup | Both apps boot; design reference opens unchanged |
| M1 | Backend foundation | Postgres + Prisma schema/migrations, security middleware, auth (JWT/refresh/Google), profile, config, audit, tests | Auth integration tests green; lockout and rotation verified |
| M2 | Content + admin API & screens | Unit/lesson/word/exercise CRUD, audio upload/serve, content validation, seed, admin screens in the app | Owner can create and publish a lesson in-app; learner path reflects it |
| M3 | Mobile shell + design system | Navigation, tokens, typography, Pitsi, buttons/cards, auth screens, onboarding, home path, settings | Signed-in learner sees a server-driven path with correct lock states |
| M4 | Lesson player | All 8 exercise renderers, attempt lifecycle, hearts, XP, completion screen, haptics/confetti | Complete demo lessons on both platforms; server-stored progress matches UI |
| M5 | Words, review, progress, notifications | Library, word detail, SRS queue, streak calendar + weekly chart, push tokens and reminders | Review session changes stages; reminder arrives at the chosen time |
| M6 | Hardening and handover | Tablet layout, accessibility pass, reduced motion, tests, README/runbooks, content intake guide | All quality gates in §12 pass; owner can seed new content unaided |

---

## 14. Decisions log (from the interview)

| Topic | Decision |
| --- | --- |
| Product form | Real app, not a mockup: native Expo app + Node REST API |
| App name / wordmark | **Puo**; mascot **Pitsi** (zebra); use the supplied logo |
| Layout targets | iOS + Android phones and tablets (no web build) |
| Repo shape | Two standalone folders, `mobile/` and `backend/`; mockup moved to `design-reference/` |
| Styling | `StyleSheet` + design tokens from the mockup's CSS variables |
| Navigation | React Navigation |
| Backend stack | Express + TypeScript, Prisma, PostgreSQL |
| Database | Managed Postgres in deployment (recommended Neon), Docker locally |
| Auth | Email + password **and** Google, both fully implemented; Google client IDs to be supplied |
| Session transport | Access JWT + rotating refresh token in `expo-secure-store`; httpOnly-cookie mode designed for any future browser client |
| Guest mode | One lesson playable, merged into the account on sign-up |
| Content | Stored in Postgres, fetched over REST; owner supplies documents + audio later |
| Audio | Owner recordings only, served by the backend; **no TTS fallback** |
| Curriculum structure | Units unlock sequentially, lessons open within a unit |
| Exercise types | All 8: translate MC, match pairs, fill blank, listen & choose, type answer, build sentence, speak back, SRS review card |
| Mistakes | Hearts system (5, 30-minute refill, lesson ends at 0) |
| Streak | One completed lesson per local day; daily goal 5 (onboarding-adjustable) |
| Language handling | Teach singular/plural and formal/informal forms from the start |
| Tuning | Server-side `AppConfig`, admin-editable |
| UI language | English UI with a bilingual string dictionary; Setswana encouragement with English support |
| Notifications | Expo push, server-scheduled reminders, preference-controlled |
| Offline | Not supported in v1; explicit connection-error states |
| Security | Validation everywhere, rate limits + lockout, server-side scoring, argon2id, audit log, helmet/CORS, no secrets client-side |
| Testing | Server unit + integration, content validation, mobile component tests, Maestro E2E |
| Deferred | Web learner app, other languages, leaderboards/social, payments, AI tutor, email verification (until an email provider exists) |

---

## 15. Open questions and risks

1. **Content is the critical path.** Nothing beyond the demo unit ships until the owner's documents and audio arrive. Unit names, phonetics and register decisions are blocked on that handover.
2. **Password recovery is unavailable** without email delivery; accounts created now cannot reset a forgotten password. Mitigation: admin-initiated reset once email exists; consider enabling an email provider before a public launch.
3. **Google sign-in cannot be tested** until OAuth client IDs exist; the flow is built behind a flag and must be verified on real devices before launch.
4. **Admin screens on a phone** are workable but slow for bulk content entry; if authoring volume grows, a web admin becomes worthwhile (explicitly deferred by the owner).
5. **Pronunciation has no automated feedback.** `SPEAK` is self-assessed; the app must say so honestly rather than imply grading.
6. **Audio hosting on the API** is fine at demo scale; large clip libraries need object storage + CDN.
7. **Push reliability** depends on Expo Push Service; delivery receipts are logged, but no in-app fallback inbox exists in v1.
8. **Tablet layout** is limited to a centred max-width column with two-column grids where useful; a genuinely tablet-native design (side-by-side reference panel) is future work.
9. **Streak timezone changes** (travelling learners) can shift a day boundary; the last write's local date is authoritative and the weekly chart rebuilds from `DailyActivity`, so history does not corrupt.
10. **Plural/formal content** must be consistent per word; the validator enforces pairing, but accuracy is a language-authority decision.

---

## 16. Content handover checklist

- [ ] Units in order, with slugs, Setswana titles, English titles, colour, short description.
- [ ] Lessons per unit, with order, titles, subtitles, and word list per lesson.
- [ ] Word table: Setswana, English, plural form, formal form, phonetic respelling, usage note, part of speech.
- [ ] Sentences for fill-blank and build-sentence, each with its English translation.
- [ ] Exercise order and types per lesson (or leave to the builder, with a stated preference).
- [ ] Audio clips per word/phrase following the naming and format in §11.3.
- [ ] Confirmation of the accepted greeting registers (Dumela vs Dumelang) and any regional variants to note.
- [ ] Named language reviewer and a review pass before publishing.
