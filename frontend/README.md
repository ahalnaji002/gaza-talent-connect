# Gaza Talent Connect — Frontend

A lightweight React + TypeScript single-page app for Gaza Talent Connect, talking to the NestJS
API in the repository root:

- Visitors browse published student profiles.
- Students register, manage their profile (including a job title), skills and projects, choose
  when to publish, and read private feedback from companies.
- Companies register, discover students, and send, edit or delete private feedback.

Built with Vite, React Router, plain CSS and the native Fetch API. There is no UI framework or
state-management library.

## Prerequisites

- Node.js 20.19+, 22.12+ or 24+
- The backend API from the repository root, configured and running (see the root `README.md`).

## Install

```powershell
cd frontend
npm ci
```

## Configure

Configuration is optional. Copy the example file only if you need to change the defaults:

```powershell
Copy-Item .env.example .env
```

| Variable                | Default                 | Purpose                                                                                     |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | `/api`                  | Base URL the browser uses for API calls.                                                    |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:3000` | Where the Vite dev and preview servers forward `/api` requests.                             |

With the default `/api`, the browser calls the Vite server, which proxies to the backend. The
backend therefore needs no CORS configuration. If you set `VITE_API_BASE_URL` to an absolute URL
on another origin (for example `http://localhost:3000/api`), the backend must allow that origin
via CORS, which it currently does not.

## Run (development)

Start the backend first, from the repository root:

```powershell
npm run start:dev
```

Then start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>.

To see students in discovery, the backend database needs the skills catalog (see the root README's
seed section) and at least one student who has added a contact email and published their profile.

## Pages

| Route                 | Access    | Description                                                                                         |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `/`                   | Public    | Talent discovery: filter by skills (any match, best matches first) with pagination. Filter state is kept in the URL. |
| `/students/:id`       | Public    | Published profile by **student profile ID**: job title, bio, links, contact email, skills and projects. Signed-in companies also see a private feedback form. |
| `/register`           | Public    | Create a student account. Signs in automatically afterwards.                                        |
| `/register/company`   | Public    | Create a company account (company name, email, password). Signs in automatically afterwards.        |
| `/login`              | Public    | Shared login for students and companies. Returns to the requested page, or to the account's own dashboard. |
| `/dashboard`          | Student   | Overview: job title, visibility status, profile checklist, skills and projects.                     |
| `/dashboard/profile`  | Student   | Edit profile fields (including job title) and public/private visibility.                            |
| `/dashboard/skills`   | Student   | Choose up to 20 skills from the catalog; saving replaces the full list (or clears it).               |
| `/dashboard/projects` | Student   | Create, edit and delete projects (inline delete confirmation).                                      |
| `/dashboard/feedback` | Student   | Private company feedback addressed to the student: company name, message and date.                  |
| `/company`            | Company   | Company dashboard: company name, links to discovery and sent feedback, recent feedback.             |
| `/company/feedback`   | Company   | Feedback the company has sent, with edit and delete (inline confirmation) and pagination.           |

Hidden, unpublished and nonexistent profiles all show the same "not available" page. Feedback is
never shown on public pages. Opening the other account type's area redirects to your own
dashboard. That redirect is only a convenience: the API independently answers `403`.

## API integration

All backend endpoints are used, through `src/api/endpoints.ts`:

| Endpoint                         | Used by                                   |
| -------------------------------- | ----------------------------------------- |
| `POST /api/auth/register`        | Register page                             |
| `POST /api/auth/register/company`| Company registration page                 |
| `POST /api/auth/login`           | Login page; auto-login after registering  |
| `GET /api/companies/me`          | Company dashboard                         |
| `POST /api/feedback`             | Feedback form on public student profiles  |
| `GET /api/feedback/sent`         | Company dashboard, Sent feedback          |
| `PATCH /api/feedback/:id`        | Sent feedback (edit)                      |
| `DELETE /api/feedback/:id`       | Sent feedback (delete)                    |
| `GET /api/students/me/feedback`  | Student Company feedback page             |
| `GET /api/students/me`           | Dashboard, Edit profile, Skills           |
| `PATCH /api/students/me`         | Edit profile                              |
| `GET /api/skills`                | Discovery filters, Skills page            |
| `PUT /api/students/me/skills`    | Skills page                               |
| `POST /api/projects`             | Projects page                             |
| `GET /api/projects/me`           | Dashboard, Projects page                  |
| `PATCH /api/projects/:id`        | Projects page                             |
| `DELETE /api/projects/:id`       | Projects page                             |
| `GET /api/students`              | Discovery (`skillIds`, `page`, `limit`)   |
| `GET /api/students/:id`          | Public profile                            |

Notes:

- Protected calls send `Authorization: Bearer <token>`.
- Empty optional text fields are sent as `null` so the backend clears them.
- NestJS error bodies (`message` as a string or a list of validation messages) appear as inline alerts.
- A `401` on any authenticated request ends the session and redirects to login.

## Sessions

The JWT from `POST /api/auth/login` is kept in `localStorage`, together with its expiry time
(`expiresIn`) and the account `role`. The role only decides which pages and links are shown; the
API checks the real role on every request. Sessions saved by the earlier version have no role, so
those users are simply asked to log in again. This storage approach suits a demonstration app. The token is never logged or put in URLs. The
session ends automatically when the token expires, when the API answers `401`, or on logout.

## Scripts

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Vite dev server with the `/api` proxy (port 5173). |
| `npm run build`     | Type-check, then build the production bundle into `dist/`. |
| `npm run preview`   | Serve the built bundle with the `/api` proxy (port 4173). |
| `npm run typecheck` | TypeScript check only.                             |
| `npm run lint`      | ESLint.                                            |
| `npm test`          | Vitest unit tests for the API client and helpers.  |

## Known limitations

- **Hosting:** the app relies on the Vite dev/preview proxy. A production deployment needs a
  reverse proxy that forwards `/api` to the backend, or CORS enabled on the backend. Either way the
  host must serve `index.html` for client-side routes.
- **Token storage:** the token lives in `localStorage`, which is readable by any script on the page.
  A production setup would prefer an httpOnly cookie. There is no refresh token; students log in
  again after the 1-hour expiry.
- **Missing account features:** the backend has no endpoints for password reset, account deletion
  or email verification, so the UI does not offer them.
- **No avatars:** there is no profile image support; initials are shown instead.
- **Test coverage:** automated tests cover the API client and helpers, not page components. The
  user journeys were checked manually in a browser.
