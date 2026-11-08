# Gaza Talent Connect

Gaza Talent Connect is a NestJS backend API for student accounts, profiles, skills, and projects. Students manage their own data; visitors can discover only profiles that students have made public. Company accounts can send students private written feedback. Messaging, ratings, job applications, and administration are outside the current MVP.

## Implemented scope

- Authentication with JWT access tokens.
- Authenticated read and update of a student's own profile and selected skills.
- A public, read-only predefined skills catalog.
- Authenticated create, list, update, and delete operations for a student's own projects.
- Public discovery and detail views for profiles that are public and have a valid contact email.
- An optional student job title shown on the own profile, discovery results, and public profiles.
- Company accounts (role `COMPANY`) that can write, edit, and delete private feedback for published students; students read feedback addressed to them.
- Interactive Swagger UI and an OpenAPI JSON document.

Public profile routes return the explicitly supplied `contactEmail`; they never return the private account email or password hash. Profiles start hidden. A profile can be published only when its contact email is valid. Public profile detail includes skills and projects; the discovery list includes skills.

## Technology

- Node.js, TypeScript, and NestJS 11
- PostgreSQL and Prisma 7 with the PostgreSQL driver adapter
- Passport JWT and `@nestjs/jwt`
- `class-validator` / `class-transformer`
- `@nestjs/swagger` for OpenAPI documentation and Swagger UI
- Jest and Supertest

## Prerequisites

- Node.js 22 LTS (22.13+) or 24, which satisfies both packages. `package.json` declares the backend range `^20.19.0 || ^22.12.0 || >=24.0.0` (Prisma 7 and `@nestjs/throttler`); `frontend/package.json` declares `^22.13.0 || ^24.0.0 || >=26.0.0` (Vitest and ESLint).
- npm
- A PostgreSQL server you can create local databases in

## Install and configure

From the repository root:

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` and replace the placeholders. `DATABASE_URL` must point to the local development database; `JWT_SECRET` must be a private signing secret. `PORT` is optional and defaults to `3000`. Leave `NODE_ENV`, `CORS_ORIGIN`, `SWAGGER_ENABLED` and `CLIENT_IP_HEADER` unset locally: the defaults allow the local Vite frontend and keep Swagger enabled. Do not commit `.env`. Production settings are described in [Production configuration and security](#production-configuration-and-security).

Generate the Prisma Client after installing dependencies:

```powershell
npx prisma generate
```

The generated client is written to `generated/prisma`, which is ignored by Git and must be regenerated after a clean install.

## PostgreSQL setup and migrations

Create the development database, then confirm `DATABASE_URL` in `.env` names that database:

```powershell
createdb gaza_talent_connect
npx prisma migrate deploy
```

`migrate deploy` applies the checked-in migrations; it does not create a database. Run it only after verifying `DATABASE_URL`. The current schema is in `prisma/schema.prisma`, and the migrations are in `prisma/migrations/`.

The `20261107150015_job_titles_company_feedback` migration only adds to the schema; nothing is removed or rewritten:

- A `user_role` enum and a `users.role` column that defaults to `STUDENT`, so existing accounts become students.
- A nullable `student_profiles.job_title` column.
- The `company_profiles` and `company_feedback` tables.

Existing databases only need `npx prisma migrate deploy` against the verified `DATABASE_URL`; no reset is required. Until the migration is applied, an API built from this version returns `500` for login and profile queries.

## Optional initial skills catalog

Seeding is manual and optional. It does not run at application startup or through `GET /api/skills`. First verify that `DATABASE_URL` points to the intended database, then set the confirmation to that database's exact name for this command only:

```powershell
$env:SKILLS_SEED_CONFIRM_DATABASE = "gaza_talent_connect"
npm run db:seed
Remove-Item Env:SKILLS_SEED_CONFIRM_DATABASE
```

The seed checks PostgreSQL's actual `current_database()` before inserting. It only inserts catalog names that are missing, so it is repeatable: running it again creates no duplicates. It never deletes or renames existing skills, never changes their IDs, and never removes student-skill links. A database seeded with the earlier 15-skill catalog gains the 35 new skills when the seed is run again. Do not confirm a development or production database without separate approval.

The predefined catalog has 50 skills:

- **Original 15:** JavaScript, TypeScript, Python, Java, C++, React, Next.js, Node.js, NestJS, PostgreSQL, MySQL, HTML, CSS, Git, Docker.
- **Front end:** Angular, Vue.js, Tailwind CSS, Bootstrap, Sass, Redux.
- **Back end:** Express.js, Django, Flask, FastAPI, Laravel, PHP, C#, .NET, Spring Boot.
- **Mobile:** Kotlin, Swift, Dart, Flutter, React Native.
- **Data and APIs:** MongoDB, Redis, SQLite, Prisma, GraphQL, REST APIs.
- **Cloud and operations:** AWS, Azure, Linux, Kubernetes, CI/CD.
- **Design and quality:** Figma, UI/UX Design, Software Testing, Cybersecurity.

Each student can select at most 20 skills from the catalog (see `PUT /api/students/me/skills`).

## Start the API and open documentation

```powershell
npm run start:dev
```

The API uses the `/api` prefix and listens on port `3000` by default. While it is running:

- Swagger UI: <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/docs-json>

Swagger is enabled by default only outside production (see `SWAGGER_ENABLED` below). At startup the API logs a one-line configuration summary: environment, allowed CORS origins, Swagger state and client-IP source. It never logs secrets or connection strings.

## Production configuration and security

### Environment variables

| Variable           | Required in production  | Purpose                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`         | Yes (`production`)      | Turns on the production rules below.                                                                                                                                                                                                                           |
| `DATABASE_URL`     | Yes                     | PostgreSQL connection URL. Use `sslmode=verify-full` for hosted databases.                                                                                                                                                                                     |
| `JWT_SECRET`       | Yes                     | HS256 signing secret. Production refuses to start if it is shorter than 32 characters or still contains the `.env.example` placeholder. It is never logged.                                                                                                    |
| `CORS_ORIGIN`      | Yes                     | Comma-separated exact frontend origins, such as `https://app.example.com`. Production refuses to start if it is missing or contains a wildcard, a path or a non-`https` origin.                                                                                |
| `SWAGGER_ENABLED`  | No                      | `true` or `false`. Defaults to `false` in production (the `/api/docs` routes return `404`) and to `true` elsewhere. Any other value stops startup.                                                                                                             |
| `CLIENT_IP_HEADER` | Yes on Render           | `cf-connecting-ip` (the only supported value) to rate-limit by the client IP that Cloudflare reports. Allowed only with `NODE_ENV=production` and `RENDER=true` (set by Render); otherwise startup fails. `X-Forwarded-For` and `True-Client-IP` are rejected. |
| `RENDER`           | Set by Render           | Render sets it to `true` automatically. Required for `CLIENT_IP_HEADER`; do not set it manually elsewhere.                                                                                                                                                     |
| `PORT`             | Usually set by the host | Listening port; defaults to `3000`. The server binds to all interfaces.                                                                                                                                                                                        |

`TEST_DATABASE_URL`, `SKILLS_SEED_CONFIRM_DATABASE` and the frontend's `VITE_DEV_PROXY_TARGET` are not used by the running production API.

### CORS

- Only origins listed in `CORS_ORIGIN` receive `Access-Control-Allow-Origin`, compared by exact match after normalising case and trailing slashes. Any other origin gets no CORS headers, so browsers block it.
- Preflight `OPTIONS` requests return `204` and allow `GET, POST, PUT, PATCH, DELETE`, the `Authorization` and `Content-Type` headers, and a 10-minute cache.
- Credentials (cookies) are not allowed; the API uses bearer tokens.
- Without `NODE_ENV=production` and with `CORS_ORIGIN` unset, the local Vite origins `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173` and `http://127.0.0.1:4173` are allowed.
- CORS is not authorization: protected routes still require a valid token and role.

### Rate limits

`@nestjs/throttler` runs as a global guard and counts requests per client:

| Scope                                                           | Limit                           |
| --------------------------------------------------------------- | ------------------------------- |
| Every API route (default)                                       | 120 requests per minute         |
| `POST /api/auth/login`                                          | 10 requests per 15 minutes      |
| `POST /api/auth/register` and `POST /api/auth/register/company` | 5 requests per hour, each route |
| `POST /api/feedback`                                            | 20 requests per hour            |
| `GET /api` (static health check)                                | Not limited                     |

- **Exceeded limits:** a request over the limit returns `429` with a `Retry-After` header. Responses also carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`.
- **What counts:** limits run before authentication and validation, so failed and invalid attempts count too.
- **Memory only:** counters live in each instance's memory. They are not shared between instances and reset when the process restarts or sleeps; a free single instance accepts this. Multiple instances would need shared storage such as Redis.
- **Automated tests:** limits are skipped only when `NODE_ENV=test`, which the E2E runner sets for the functional suites. The security suite enables them explicitly.

### Client IP and reverse proxies

Express `trust proxy` stays off, and `X-Forwarded-For` is never used, because proxies such as Render's append to it rather than replace it, so clients can forge its entries.

- **Default:** without `CLIENT_IP_HEADER`, the limiter uses the TCP peer address and ignores every client-supplied forwarding header.
- **Render production setting:** behind Render, every request arrives from Render's proxy, so with the default all clients would share one bucket. On a **public Render web service**, set `NODE_ENV=production` and `CLIENT_IP_HEADER=cf-connecting-ip`. Render sets `RENDER=true` itself. Render documents that public web-service traffic passes through Cloudflare, which writes `CF-Connecting-IP` on every request and overwrites any value the caller sent.
- **Where the header is allowed:** `cf-connecting-ip` is the only accepted value, and only when `NODE_ENV=production` and `RENDER=true`. In any other environment, or in production without `RENDER=true`, the API refuses to start. This prevents the header from being enabled by accident locally or on another host.
- **Rejected values:** `X-Forwarded-For` is rejected because clients control its leftmost entries. `True-Client-IP` is rejected because Render does not document that it is overwritten, so a value sent by the client could reach the API unchanged.
- **Missing or malformed values:** the header is used only if it contains exactly one valid IP. Otherwise the peer address is used, so missing or malformed values cannot be rotated to get fresh limits.
- **IPv6:** clients are grouped by `/64`.
- **Limitation:** `RENDER=true` is a configuration guard, not proof that a request passed through Cloudflare. Anyone who can set environment variables can set it. If the API can be reached directly, without Render's edge in front, clients can choose the `CF-Connecting-IP` value and get separate rate-limit budgets. Never enable the trusted header on a directly reachable or otherwise untrusted deployment; leave it unset there, which is always safe but makes all clients behind one proxy share a budget.

### Security headers

`helmet` sets standard headers on every response:

- `Content-Security-Policy` (default `'self'` policy, compatible with the bundled Swagger UI).
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer` and the cross-origin isolation headers.
- `X-Powered-By` is removed.
- `upgrade-insecure-requests` is added only in production, so local Swagger over `http` keeps working.

### Production build and start

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

- Install dev dependencies during the build: the `prisma` CLI and `dotenv` used by `prisma7.config.ts` are dev dependencies.
- `npm run start:prod` runs `node dist/src/main.js`.
- The frontend is built separately with `VITE_API_BASE_URL` set to the API's public `/api` URL (see `frontend/README.md`).

## API endpoints

All routes below include the `/api` prefix. “Student” and “Company” mean the request must include `Authorization: Bearer <accessToken>` for an account with that role. A missing or invalid token returns `401`; a valid token for the other role returns `403`.

| Method | Endpoint                     | Access  | Success                                                |
| ------ | ---------------------------- | ------- | ------------------------------------------------------ |
| POST   | `/api/auth/register`         | Public  | `201`, safe student account/profile summary            |
| POST   | `/api/auth/register/company` | Public  | `201`, safe company account summary                    |
| POST   | `/api/auth/login`            | Public  | `200`, JWT access token and `role`                     |
| GET    | `/api/students/me`           | Student | `200`, own profile, including while hidden             |
| PATCH  | `/api/students/me`           | Student | `200`, updated own profile                             |
| GET    | `/api/skills`                | Public  | `200`, `{id,name}` array ordered by name then ID       |
| PUT    | `/api/students/me/skills`    | Student | `200`, replaced `{id,name}` skill array                |
| GET    | `/api/students/me/feedback`  | Student | `200`, `{data,meta}` feedback addressed to the student |
| POST   | `/api/projects`              | Student | `201`, created project                                 |
| GET    | `/api/projects/me`           | Student | `200`, own projects newest first                       |
| PATCH  | `/api/projects/:id`          | Student | `200`, updated owned project                           |
| DELETE | `/api/projects/:id`          | Student | `204`, no response body                                |
| GET    | `/api/students`              | Public  | `200`, `{data,meta}` discovery response                |
| GET    | `/api/students/:id`          | Public  | `200`, published profile detail                        |
| GET    | `/api/companies/me`          | Company | `200`, own company `{id,name}`                         |
| POST   | `/api/feedback`              | Company | `201`, created private feedback                        |
| GET    | `/api/feedback/sent`         | Company | `200`, `{data,meta}` feedback the company wrote        |
| PATCH  | `/api/feedback/:id`          | Company | `200`, updated own feedback                            |
| DELETE | `/api/feedback/:id`          | Company | `204`, no response body                                |

### Authentication

Registration accepts `fullName` (2–150 characters), `email` (valid, up to 255 characters), and `password` (8–72 UTF-8 bytes, with at least one English letter and one number). The account email is normalized to lowercase. Registration returns a safe summary and creates a hidden profile. A duplicate email returns `409`.

Login accepts `email` and `password`; invalid credentials return `401`. The current login DTO enforces a maximum of 72 UTF-8 password bytes; short or otherwise incorrect credentials are rejected by authentication with `401`. A successful response contains `accessToken`, `tokenType: "Bearer"`, `expiresIn: 3600`, and `role` (`STUDENT` or `COMPANY`). Students and companies use the same login route. There is no refresh-token endpoint in this MVP.

Company registration (`POST /api/auth/register/company`) accepts `companyName` (2–150 characters after trimming), `email`, and `password`. Email and password follow the same rules as student registration. It returns `{ id, email, role: "COMPANY", companyProfile: { id, name } }`. Emails are unique across students and companies; a duplicate returns `409`.

### Roles and authorization

- The server assigns roles: student registration creates `STUDENT` accounts and company registration creates `COMPANY` accounts. A `role` field sent by a client is rejected with `400`. There is no administrator role.
- The JWT still signs only the user ID (`sub`). On every protected request the server reads the account and its role from the database. A client therefore cannot change its role, tokens issued before roles existed keep working, and tokens for deleted accounts are rejected with `401`.
- `RolesGuard` limits student routes (`/students/me`, `/students/me/skills`, `/students/me/feedback`, `/projects`) to students and company routes (`/companies/me`, `/feedback`) to companies. Using the wrong account type returns `403`.

### Student profiles and skills

`GET /api/students/me` returns `id`, `fullName`, `jobTitle`, `bio`, `location`, `contactEmail`, `githubUrl`, `portfolioUrl`, `isPublic`, and `skills`. Nullable fields appear as `null`; skills are `{id,name}` objects and are empty when none are assigned.

`PATCH /api/students/me` accepts optional `fullName` (2–150), `jobTitle` (up to 100 after trimming; empty text or `null` clears it, and publishing does not require it), `bio` (up to 1,000), `location` (up to 150), `contactEmail` (valid email, up to 255), `githubUrl` (HTTPS, up to 2,048), `portfolioUrl` (HTTP/HTTPS, up to 2,048), and `isPublic` (boolean). Optional nullable fields can be cleared with `null`, except `fullName` and `isPublic`. The resulting profile must have a valid contact email to be public; it can be hidden and have its contact email cleared in the same request. Invalid input or publication state returns `400`; missing profile returns `404`.

`PUT /api/students/me/skills` accepts `{ "skillIds": ["uuid", "uuid"] }`, with 0–20 distinct UUIDs that exist in the catalog. Sending `[]` clears the student's skills. Replacement is atomic; invalid or unknown IDs return `400`. Students cannot create or modify catalog entries.

`GET /api/skills` is public and returns `[]` if the catalog is empty.

### Projects

Project creation requires `title` (3–150 characters). `description` is optional and up to 2,000 characters; `githubUrl` must use HTTPS and `demoUrl` may use HTTP or HTTPS. URL fields are limited to 2,048 characters. PATCH accepts partial changes and can clear nullable fields with `null`. Clients cannot choose or change the owner. Updating or deleting a nonexistent or non-owned project returns `404`; malformed IDs return `400`.

### Public student discovery

`GET /api/students` accepts optional comma-separated `skillIds` and pagination parameters `page` (default `1`, minimum `1`) and `limit` (default `10`, range `1–50`). A profile matches any requested skill. Results rank by matching-skill count descending, then full name and profile ID, and are paginated after ranking. The response is `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.

`GET /api/students/:id` uses the **student profile ID**, not the account user ID. It returns the public profile, skills, and projects. Both discovery routes include only profiles with `isPublic: true` and a valid contact email. Hidden or nonexistent detail returns `404`; invalid IDs, skill UUIDs, or pagination values return `400`. Discovery items and the detail include `jobTitle`. Private company feedback is never included in either route.

### Private company feedback

Feedback is private written text, not a public rating:

- Only the company that wrote it and the student it is addressed to can read it.
- It never appears in discovery, public profiles, or any other public response.

`POST /api/feedback` (company) accepts `{ "studentProfileId": "<student profile ID>", "message": "..." }`:

- The message is trimmed and must contain 1–2,000 characters.
- Feedback can be written only for published profiles (public with a valid contact email). Hidden and nonexistent profiles both return the same `404`.
- The response is `{ id, message, createdAt, updatedAt, student: { id, fullName } }`.

`GET /api/feedback/sent` (company) lists the company's own feedback, newest first, as `{ data, meta }`. `PATCH /api/feedback/:id` replaces the message and `DELETE /api/feedback/:id` removes it. Feedback written by another company returns `404`.

`GET /api/students/me/feedback` (student) lists feedback addressed to the authenticated student, newest first. Each item is `{ id, message, createdAt, updatedAt, company: { name } }`; the company's account email and IDs are not included.

Both list routes accept `page` (default `1`) and `limit` (default `10`, range `1–50`). The database enforces the student and company foreign keys (with cascading deletes) and a check that messages are not blank.

`GET /api/companies/me` (company) returns the company's `{ id, name }`.

## Optional frontend

The `frontend/` folder contains a React + TypeScript (Vite) web app that uses these endpoints for talent discovery, public profiles, student and company registration and login, student profile, skill and project management, and private company feedback. With the API running, start it in a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Then open <http://localhost:5173>. The Vite dev server proxies `/api` to `http://localhost:3000`, so no backend CORS configuration is needed. See [`frontend/README.md`](frontend/README.md) for configuration, pages, and known limitations. The backend TypeScript configs exclude `frontend/` so `npm run build` and the backend tests are unaffected.

## Tests

Run unit tests:

```powershell
npm test -- --runInBand
```

E2E tests require a separate PostgreSQL database named exactly `gaza_talent_connect_test`; do not use the development database. Create it once and apply the checked-in migration to it explicitly:

```powershell
createdb gaza_talent_connect_test
$env:DATABASE_URL = "postgresql://postgres:REPLACE_WITH_LOCAL_PASSWORD@localhost:5432/gaza_talent_connect_test?schema=public"
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
```

Set `TEST_DATABASE_URL` in the current PowerShell process to that test database URL, then run the safe runner:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:REPLACE_WITH_LOCAL_PASSWORD@localhost:5432/gaza_talent_connect_test?schema=public"
npm run test:e2e
Remove-Item Env:TEST_DATABASE_URL
```

The runner rejects any URL whose database name is not `gaza_talent_connect_test` and passes the verified test URL to Jest as `DATABASE_URL`. E2E tests must not be run against the development database.

## Evaluation walkthrough

1. Install dependencies, copy `.env.example` to `.env`, and set local database and JWT values.
2. Run `npx prisma generate`, apply migrations to the development database, and optionally run the guarded skills seed.
3. Start the API with `npm run start:dev` and inspect all documented routes at `/api/docs`.
4. Register a demo student, log in to obtain a bearer token, and use the protected profile, skills, and project operations in Swagger. To test public discovery, set a valid contact email and explicitly publish that profile first.
