# Gaza Talent Connect

## Project Overview

Gaza Talent Connect is a backend API built with NestJS, TypeScript, PostgreSQL, and Prisma. The currently implemented endpoints support student registration, JWT login, authenticated profile, skill, and project management, and public discovery of published student profiles. Company accounts and messaging are outside the current scope.

## Features

- Student registration and JWT login.
- Read and update the authenticated student's own profile.
- Replace the authenticated student's selected skills from the predefined catalog.
- Create, list, update, and delete the authenticated student's projects.
- Public read-only catalog of predefined skills.
- Public discovery of published student profiles by skills.
- Public details for published profiles, including their skills and projects.
- Profiles are hidden by default. Publishing requires a valid contact email; the private account email is not returned by profile routes.
- Profile skills are returned as `{ id, name }` objects.

### Read your profile

```http
GET /api/students/me
Authorization: Bearer <accessToken>
```

The response contains `id`, `fullName`, `bio`, `location`, `contactEmail`, `githubUrl`, `portfolioUrl`, `isPublic`, and `skills`. Nullable profile fields are returned as `null`; `skills` is an empty array when the student has no skills. This route also returns the owner's profile while it is hidden.

### Update your profile

```http
PATCH /api/students/me
Authorization: Bearer <accessToken>
Content-Type: application/json
```

All supported fields are optional: `fullName`, `bio`, `location`, `contactEmail`, `githubUrl`, `portfolioUrl`, and `isPublic`. Nullable fields (`bio`, `location`, `contactEmail`, `githubUrl`, and `portfolioUrl`) can be cleared with `null`; `fullName` and `isPublic` cannot be `null`. GitHub URLs must use HTTPS. Portfolio URLs may use HTTP or HTTPS. When the resulting profile is public, `contactEmail` must be valid and present. A profile can be hidden and its contact email cleared in the same request.

Example request:

```json
{
  "bio": "Backend developer",
  "location": "Gaza",
  "contactEmail": "student@example.com",
  "githubUrl": "https://github.com/student",
  "portfolioUrl": null,
  "isPublic": false
}
```

Successful updates return `200` with the same profile shape as `GET /api/students/me`. Requests without a valid JWT return `401`; a missing profile returns `404`; invalid fields or publication state return `400`.

### List predefined skills

```http
GET /api/skills
```

This public endpoint does not require a JWT. It returns `200` with a direct array of `{ id, name }` objects ordered by `name` and then `id`; it returns `[]` when the catalog is empty. The API does not create, update, or delete catalog skills.

### Replace your skills

```http
PUT /api/students/me/skills
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Send `{ "skillIds": ["uuid-1", "uuid-2"] }` to replace the complete skill list for the authenticated student's profile. The array accepts 0–20 distinct UUIDs that exist in the catalog; send `[]` to clear all assigned skills. A successful request returns `200` with the resulting array of `{ id, name }` skills. Missing or invalid JWT returns `401`; a missing student profile returns `404`; invalid input or unknown skill IDs returns `400`. The operation is atomic, and students cannot modify the shared catalog.

### Manage your projects

All project routes require a JWT. A project is assigned to the authenticated student's profile; clients cannot choose or change its owner.

```http
POST /api/projects
GET /api/projects/me
PATCH /api/projects/<project-id>
DELETE /api/projects/<project-id>
Authorization: Bearer <accessToken>
```

Create a project with a required `title` (3–150 characters) and optional `description` (up to 2,000 characters), `githubUrl` (HTTPS), and `demoUrl` (HTTP or HTTPS). URL values are limited to 2,048 characters by the database fields. `POST` returns `201` with the project; `GET` returns the authenticated student's projects newest first; `PATCH` accepts partial updates and returns `200`; `DELETE` returns `204` with no body. Nullable fields `description`, `githubUrl`, and `demoUrl` can be set to `null` in `PATCH` to clear them. Missing or non-owned project IDs return `404`; invalid input and malformed UUIDs return `400`; missing or invalid JWT returns `401`.

### Discover public students

```http
GET /api/students?skillIds=<uuid>,<uuid>&page=1&limit=10
GET /api/students/<profile-id>
```

These routes are public and do not require a JWT. The list endpoint matches a profile when it has **any** requested skill, ranks profiles by matching-skill count descending, then `fullName` and profile `id`, and paginates after ranking. Without `skillIds`, it lists all eligible profiles ordered by `fullName` and `id`. `page` defaults to `1`; `limit` defaults to `10` and accepts `1–50`.

The list response is `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`. Each item contains `id`, `fullName`, `bio`, `location`, `contactEmail`, `githubUrl`, `portfolioUrl`, `isPublic`, and `skills` (`{ id, name }`). Public detail uses the student profile ID and adds `projects` (`id`, `title`, `description`, `githubUrl`, `demoUrl`, `createdAt`, `updatedAt`). Only profiles with `isPublic: true` and a valid `contactEmail` are returned. Account email and password data are never exposed. Hidden or nonexistent profile details return `404`; malformed IDs, skill UUIDs, or pagination values return `400`.

## Setup

Install dependencies:

```bash
npm install
```

Configure `DATABASE_URL` with the PostgreSQL connection string and `JWT_SECRET` with a private signing secret in the runtime environment. Ensure the database schema has been set up before starting the API.

The initial skill catalog is installed manually; application startup and `GET /api/skills` never run the seed. Verify that `DATABASE_URL` targets the database you intend to seed, then set the confirmation to that database's exact name. For example, for the isolated test database:

```powershell
$env:SKILLS_SEED_CONFIRM_DATABASE = "gaza_talent_connect_test"
npm run db:seed
Remove-Item Env:SKILLS_SEED_CONFIRM_DATABASE
```

The seed checks PostgreSQL's actual `current_database()` against `SKILLS_SEED_CONFIRM_DATABASE` and aborts before inserting if they differ. Do not confirm a development or production database without separate approval. The seed is repeatable and does not delete skills or student-skill links.

Initial catalog: JavaScript, TypeScript, Python, Java, C++, React, Next.js, Node.js, NestJS, PostgreSQL, MySQL, HTML, CSS, Git, Docker.

Start the API:

```bash
npm run start:dev
```

The API listens on port `3000` by default and uses the `/api` prefix.

Interactive OpenAPI documentation is available at `http://localhost:3000/api/docs`.

## Dependencies

- NestJS 11 and TypeScript
- Prisma 7 and PostgreSQL
- Passport JWT and `@nestjs/jwt`
- `@nestjs/swagger` for OpenAPI documentation and Swagger UI
- `class-validator` and `class-transformer`
- Jest and Supertest for tests

No dependency was added for the profile or skills catalog endpoints.

## Tests

Run unit tests:

```bash
npm test -- --runInBand
```

Run E2E tests through the repository's safety-checked runner:

```bash
$env:TEST_DATABASE_URL = "<PostgreSQL URL for gaza_talent_connect_test>"
npm run test:e2e
```

The runner rejects URLs whose database name is not `gaza_talent_connect_test`. Do not run E2E tests against the development database.
