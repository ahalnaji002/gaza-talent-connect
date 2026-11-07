# Gaza Talent Connect

Gaza Talent Connect is a NestJS backend API for student accounts, profiles, skills, and projects. Students manage their own data; visitors can discover only profiles that students have made public. Company accounts and messaging are outside the current MVP.

## Implemented scope

- Authentication with JWT access tokens.
- Authenticated read and update of a student's own profile and selected skills.
- A public, read-only predefined skills catalog.
- Authenticated create, list, update, and delete operations for a student's own projects.
- Public discovery and detail views for profiles that are public and have a valid contact email.
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

- Node.js 20.19+, 22.12+, or 24+
- npm
- A PostgreSQL server you can create local databases in

## Install and configure

From the repository root:

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` and replace the placeholders. `DATABASE_URL` must point to the local development database; `JWT_SECRET` must be a private signing secret. `PORT` is optional and defaults to `3000`. Do not commit `.env`.

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

`migrate deploy` applies the checked-in migrations; it does not create a database. Run it only after verifying `DATABASE_URL`. The current schema is in `prisma/schema.prisma`, and the initial migration is in `prisma/migrations/`.

## Optional initial skills catalog

Seeding is manual and optional. It does not run at application startup or through `GET /api/skills`. First verify that `DATABASE_URL` points to the intended database, then set the confirmation to that database's exact name for this command only:

```powershell
$env:SKILLS_SEED_CONFIRM_DATABASE = "gaza_talent_connect"
npm run db:seed
Remove-Item Env:SKILLS_SEED_CONFIRM_DATABASE
```

The seed checks PostgreSQL's actual `current_database()` before inserting. It is repeatable and does not delete or rename existing skills or remove student-skill links. Do not confirm a development or production database without separate approval.

Initial catalog: JavaScript, TypeScript, Python, Java, C++, React, Next.js, Node.js, NestJS, PostgreSQL, MySQL, HTML, CSS, Git, Docker.

## Start the API and open documentation

```powershell
npm run start:dev
```

The API uses the `/api` prefix and listens on port `3000` by default. While it is running:

- Swagger UI: <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/docs-json>

## API endpoints

All routes below include the `/api` prefix. “JWT” means the request must include `Authorization: Bearer <accessToken>`.

| Method | Endpoint                  | Access | Success                                          |
| ------ | ------------------------- | ------ | ------------------------------------------------ |
| POST   | `/api/auth/register`      | Public | `201`, safe account/profile summary              |
| POST   | `/api/auth/login`         | Public | `200`, JWT access token                          |
| GET    | `/api/students/me`        | JWT    | `200`, own profile, including while hidden       |
| PATCH  | `/api/students/me`        | JWT    | `200`, updated own profile                       |
| GET    | `/api/skills`             | Public | `200`, `{id,name}` array ordered by name then ID |
| PUT    | `/api/students/me/skills` | JWT    | `200`, replaced `{id,name}` skill array          |
| POST   | `/api/projects`           | JWT    | `201`, created project                           |
| GET    | `/api/projects/me`        | JWT    | `200`, own projects newest first                 |
| PATCH  | `/api/projects/:id`       | JWT    | `200`, updated owned project                     |
| DELETE | `/api/projects/:id`       | JWT    | `204`, no response body                          |
| GET    | `/api/students`           | Public | `200`, `{data,meta}` discovery response          |
| GET    | `/api/students/:id`       | Public | `200`, published profile detail                  |

### Authentication

Registration accepts `fullName` (2–150 characters), `email` (valid, up to 255 characters), and `password` (8–72 UTF-8 bytes, with at least one English letter and one number). The account email is normalized to lowercase. Registration returns a safe summary and creates a hidden profile. A duplicate email returns `409`.

Login accepts `email` and `password`; invalid credentials return `401`. The current login DTO enforces a maximum of 72 UTF-8 password bytes; short or otherwise incorrect credentials are rejected by authentication with `401`. A successful response contains `accessToken`, `tokenType: "Bearer"`, and `expiresIn: 3600`. There is no refresh-token endpoint in this MVP.

### Student profiles and skills

`GET /api/students/me` returns `id`, `fullName`, `bio`, `location`, `contactEmail`, `githubUrl`, `portfolioUrl`, `isPublic`, and `skills`. Nullable fields appear as `null`; skills are `{id,name}` objects and are empty when none are assigned.

`PATCH /api/students/me` accepts optional `fullName` (2–150), `bio` (up to 1,000), `location` (up to 150), `contactEmail` (valid email, up to 255), `githubUrl` (HTTPS, up to 2,048), `portfolioUrl` (HTTP/HTTPS, up to 2,048), and `isPublic` (boolean). Optional nullable fields can be cleared with `null`, except `fullName` and `isPublic`. The resulting profile must have a valid contact email to be public; it can be hidden and have its contact email cleared in the same request. Invalid input or publication state returns `400`; missing profile returns `404`.

`PUT /api/students/me/skills` accepts `{ "skillIds": ["uuid", "uuid"] }`, with 0–20 distinct UUIDs that exist in the catalog. Sending `[]` clears the student's skills. Replacement is atomic; invalid or unknown IDs return `400`. Students cannot create or modify catalog entries.

`GET /api/skills` is public and returns `[]` if the catalog is empty.

### Projects

Project creation requires `title` (3–150 characters). `description` is optional and up to 2,000 characters; `githubUrl` must use HTTPS and `demoUrl` may use HTTP or HTTPS. URL fields are limited to 2,048 characters. PATCH accepts partial changes and can clear nullable fields with `null`. Clients cannot choose or change the owner. Updating or deleting a nonexistent or non-owned project returns `404`; malformed IDs return `400`.

### Public student discovery

`GET /api/students` accepts optional comma-separated `skillIds` and pagination parameters `page` (default `1`, minimum `1`) and `limit` (default `10`, range `1–50`). A profile matches any requested skill. Results rank by matching-skill count descending, then full name and profile ID, and are paginated after ranking. The response is `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.

`GET /api/students/:id` uses the **student profile ID**, not the account user ID. It returns the public profile, skills, and projects. Both discovery routes include only profiles with `isPublic: true` and a valid contact email. Hidden or nonexistent detail returns `404`; invalid IDs, skill UUIDs, or pagination values return `400`.

## Optional frontend

The `frontend/` folder contains a React + TypeScript (Vite) web app that uses these endpoints for talent discovery, public profiles, registration and login, and student profile, skill and project management. With the API running, start it in a second terminal:

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
