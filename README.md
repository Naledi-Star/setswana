# Puo — learn Setswana

A production-shaped implementation of the Puo spec: a native learner app, an API that owns every learning decision, an admin path for content and configuration, and a seed content pipeline.

```
backend/   Express + TypeScript + Prisma + PostgreSQL API
mobile/    Expo + React Native learner app
design-reference/   The Figma Make prototype used as the visual reference (not shipped)
content pipeline lives in backend/content
```

## Quick start

```bash
# API
cd backend
cp .env.example .env
npm install
npm run db:local        # or: docker compose up -d
npx prisma migrate dev
npm run seed
npm run dev             # http://localhost:4000

# App
cd ../mobile
npm install
npm start
```

Both apps have their own README with the details, including the test database and the admin seed script.

## What is implemented

**Learner app** — welcome/sign-in/sign-up/guest, password reset, onboarding (goal → level → reminder), learn path with units and locked lessons, eight exercise renderers (translate, multiple choice, listen, match pairs, order words, fill blank, type, speak), hearts and out-of-hearts flow, session complete with XP/streak, word library, word detail, SRS review, progress (streak, accuracy, weekly chart), settings (goal, reminders, account deletion), and an admin area for content and config.

**API** — server-side scoring and progression, idempotent answer submission, one attempt per lesson at a time, hearts with regeneration, daily goal and streak in the learner's timezone, unit/lesson unlocks, SRS scheduling, guest sessions with merge on sign-up, rotating refresh tokens, argon2id passwords, lockout, rate limits, structured errors, audit log, admin CRUD + validate + publish, media serving, account deletion with a 30-day grace period, reminder job, optional Expo push.

**Design** — palette, typography, mascot (Pitsi the zebra), illustrations and component shapes come from the Figma Make reference; no screens or features exist that the spec did not ask for.

## Deliberate limits

- Content is seed/demo content: only the vocabulary verified from the mockup is used, listening exercises are omitted until recordings exist, and unverified phonetics are left out rather than invented.
- Email delivery is not configured, so password reset prints the link in the API console and reports `features.emailDelivery: false` to the app. Email verification is out of scope per the spec.
- Push needs a configured EAS project and `PUSH_ENABLED=true`; the preference is stored either way.
- Google sign-in stays hidden until client IDs are configured.
- The API's rate limiter is in-memory, suitable for a single instance.
- No simulator or device was available in this environment, so audio, push and tablet layout were not exercised on hardware; both apps are typechecked, unit/integration tested, bundled, and the API flows were driven end to end over HTTP.
