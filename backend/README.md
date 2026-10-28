# Puo API

Express + TypeScript + Prisma + PostgreSQL. Every lesson, word, score, heart, streak and unlock decision lives here; the mobile app only renders what this server returns.

## Run it

```bash
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy     # or: npx prisma migrate dev
npm run seed                  # content (idempotent)
npm run dev                   # http://localhost:4000
```

Postgres options:

- Docker: `docker compose up -d` (postgres 16 on 5432).
- No Docker: `npm run db:local` starts the bundled `embedded-postgres` on the port in `DATABASE_URL` and keeps data in `backend/.pgdata`. Approve install scripts once with `npm approve-scripts --all` if npm blocks them.
- Managed Postgres: point `DATABASE_URL` at Neon/Supabase/etc. and run `prisma migrate deploy`.

Create an admin:

```bash
npm run seed:admin -- --email=you@example.com --password="a-long-password" --name="Your name"
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Watch-mode API on `PORT` (default 4000) |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Vitest unit + integration tests |
| `npm run seed` | Upsert `content/units/*.json` into Postgres |
| `npm run content:validate` | Validate unit files against the content schema |
| `npm run seed:admin` | Create/promote an admin |
| `npm run db:local` | Local Postgres without Docker |

Integration tests use `TEST_DATABASE_URL` and are skipped when it is unset. With the local Postgres running:

```bash
# create the test database once
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test
```

## Content pipeline

1. Put lesson documents' output into `content/units/<slug>.json` (schema in `src/content/schema.ts`).
2. Drop recordings in `content/audio/<slug>.mp3` (or `.m4a` / `.wav`), referenced as `/media/<slug>.mp3`.
3. `npm run content:validate` — fails on missing audio, bad answer keys, unknown words, duplicate slugs, invalid exercise shapes. While a unit's clips are still unrecorded, set `"audioPending": true` on the unit so the missing files are listed as a to-record checklist (warnings) instead of failing the seed. Remove the flag once everything is recorded and validation goes strict again.
4. `npm run seed` — idempotent upsert by slug. A lesson dropped from a unit file is deleted so the file stays the source of truth; if a learner already attempted it, the row is kept with its history but unpublished so it leaves the path.
5. Publish units/lessons through the admin API or app; drafts never reach learners.

Lesson 1 ("Basic Greetings and Expressions") is twelve lessons on the path: the nine sections of the owner's guide, each one a full lesson with a recording, a fill-in-the-blank, a record-yourself task and a closing mini test, plus a review lesson after every three sections. Match-the-pairs appears only where a section (or review) has three or more phrases to pair. The Cultural Context Tips sit at the end of the last review, once all nine sections are finished.

Every word, guide row and audio exercise declares its clip (`/media/<slug>.m4a` or `.mp3`) and `audioPending: true` records that only the section 1 clips exist so far. Audio is only advertised to clients once the file is on disk (`servableAudioUrl`), so the app hides the speaker button and listening exercises skip politely until the owner records a clip and drops it in `content/audio/` — at which point it plays with no re-seed and no app release. `dumela.m4a`, `dumela-rra.m4a` and `dumela-mma.m4a` (plus `-slow` takes) are recorded; everything else is the to-record checklist that `npm run content:validate` prints as warnings.

## API surface

Base: `/api/v1`. Bearer access JWT (15 min) + opaque rotating refresh token (30 days). Guest sessions use a `guest_…` bearer token limited to the first published lesson.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/guest`, `/auth/password/forgot`, `/auth/password/reset` |
| Profile | `GET/PATCH/DELETE /me`, `POST /devices`, `DELETE /devices/:id` |
| Learn | `GET /path`, `GET /lessons/guest-next`, `GET /lessons/:id`, `POST /lessons/:id/start` |
| Attempts | `POST /attempts/:id/answers` (idempotency key supported), `/complete`, `/abandon`, `GET /attempts/:id` |
| Words | `GET /words`, `GET /words/:id`, `GET /review/queue`, `POST /review/answers` |
| Progress | `GET /progress/summary`, `GET /config` |
| Admin | `/admin/units`, `/admin/lessons`, `/admin/exercises`, `/admin/words`, `/admin/audio`, `/admin/config`, `/admin/content/validate`, `/admin/audit`, `/admin/health` |
| Media | `GET /media/:filename` (immutable cache headers) |

Errors:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": {}, "requestId": "…" } }
```

## Security

- Prisma parameterised queries only; no unsafe raw SQL (the admin audit query uses `$queryRawUnsafe` only in tests to truncate).
- Zod validation on every body/query/param; strict schemas reject unknown keys.
- argon2id password hashing; 10+ characters, blocklist, no email/name in the password.
- Login lockout after 5 failures in 15 minutes (tracked in Postgres).
- Access JWT 15 min; refresh tokens hashed at rest, rotated on use, reuse revokes the family.
- Rate limits: login/register/forgot/refresh per IP, answers 120/min/user, admin 60/min, everything authenticated 300/min.
- Helmet headers, CORS closed by default (allow-list via `CORS_ORIGINS`), 100 KB JSON limit, pino logs with secrets redacted.
- Server-side scoring only: clients never send XP, hearts or streak values.
- Admin routes require the `ADMIN` role and write an audit event on every mutation.
- Account deletion is soft for 30 days, revoking sessions and push tokens immediately.

## Known deviations and limits

- **Argon2 library**: `@node-rs/argon2` (prebuilt binaries) instead of the native `argon2` package — same argon2id parameters, no compiler needed on Windows.
- **Email**: no provider is configured. Reset links are printed by the console transport; `features.emailDelivery` is `false`, so the app tells users email delivery is off. Email verification is deferred, as specified.
- **Push**: requires `PUSH_ENABLED=true`, a feature flag, `expo-server-sdk`, and device tokens. Local notifications are not used.
- **Rate limiting** is in-memory (single instance). Move to Redis if the API is horizontally scaled.
- **Google sign-in** returns `503 GOOGLE_NOT_CONFIGURED` until `GOOGLE_CLIENT_IDS` is set.
- **Audio** is served from local disk. At larger volume, move `/media` to object storage behind a CDN.
