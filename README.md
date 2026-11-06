# Gaza Talent Connect

## Project Overview

Gaza Talent Connect is a backend API built with NestJS, TypeScript, PostgreSQL, and Prisma. The currently implemented endpoints support student registration, JWT login, and authenticated reading and updating of each student's own profile. Public Talent Discovery is planned for Task 06 and is not implemented yet.

## Features

- Student registration and JWT login.
- Read and update the authenticated student's own profile.
- Profiles are hidden by default. Publishing requires a valid contact email; the private account email is not returned by profile routes.
- Profile skills are returned as `{ id, name }` objects.
- Public Talent Discovery is planned for Task 06; no public student directory endpoint is available yet.

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

## Setup

Install dependencies:

```bash
npm install
```

Configure `DATABASE_URL` with the PostgreSQL connection string and `JWT_SECRET` with a private signing secret in the runtime environment. Ensure the database schema has been set up before starting the API.

Start the API:

```bash
npm run start:dev
```

The API listens on port `3000` by default and uses the `/api` prefix.

## Dependencies

- NestJS 11 and TypeScript
- Prisma 7 and PostgreSQL
- Passport JWT and `@nestjs/jwt`
- `class-validator` and `class-transformer`
- Jest and Supertest for tests

No dependency was added for the profile update endpoint.

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
