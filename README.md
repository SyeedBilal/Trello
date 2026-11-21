# Taskboard

A Trello-style project management app for organizing projects into boards, lists, and cards. It combines persistent drag-and-drop task management with an AI-generated summary grounded in the board's actual data.

## Features

- Custom registration and login with protected routes.
- Board, list, and card CRUD with per-user ownership checks.
- Card priorities, descriptions, labels, and due dates.
- Drag cards between lists and reorder cards/lists; ordering persists to PostgreSQL.
- AI board summaries with backend-calculated task statistics, high-priority tasks, and overdue tasks.
- Responsive React interface with loading, empty, and error states.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, dnd-kit.
- Backend: Node.js 22, Express, TypeScript, Zod.
- Database: Neon PostgreSQL via Prisma.
- Authentication: Argon2id password hashing, JWT access tokens, hashed/rotated refresh tokens in HttpOnly cookies.
- AI: Groq Chat Completions API; model configured through `GROQ_MODEL`.

## Architecture

```text
Browser
  └── React + TypeScript (Vercel)
        └── HTTPS REST API (Express on Render)
              ├── Prisma ORM ── Neon PostgreSQL
              └── AI summary service ── Groq API
```

## Screenshots and demo

No screenshots or public demo URL are included yet. Add screenshots captured from the final application and the verified public URL here after deployment; do not use placeholder URLs.

## Project layout

```text
apps/
  frontend/                 React application
    src/components/         Card modal and route guards
    src/context/            Authentication state
    src/pages/              Login, registration, dashboard, board
    src/services/            Frontend API clients
  backend/                  Express application
    src/config/              Validated environment configuration
    src/middleware/          Authentication, validation, errors
    src/modules/              Auth, boards, lists, cards, AI
    prisma/                   Schema and SQL migrations
    tests/                    API and AI-support tests
docs/                        Phase documentation and demo script
render.yaml                  Render backend Blueprint
vercel.json                  Vercel frontend build and SPA fallback
```

## Local setup

Requirements: Node.js `>=22.12 <23`, npm, and an existing PostgreSQL database (Neon is used by this project).

1. Install from the repository root:

   ```sh
   npm ci
   ```

2. Configure backend environment:

   ```sh
   cp apps/backend/.env.example apps/backend/.env
   ```

   Fill in the Neon pooled/runtime URL, direct/migration URL, a strong JWT secret, and Groq credentials if AI summaries are needed. Never commit `.env`.

3. Configure the frontend:

   ```sh
   cp apps/frontend/.env.example apps/frontend/.env
   ```

   The local API URL defaults to `http://localhost:4000/api`.

4. Apply the committed migrations to the selected database and generate Prisma Client:

   ```sh
   npm run db:migrate:deploy
   npm run db:generate
   ```

   For a new schema change during local development, create a migration with `npm run db:migrate -- --name <migration_name>`. Do not use `prisma db push` for production.

5. Start the frontend and backend:

   ```sh
   npm run dev
   ```

   Frontend: `http://localhost:5173`  
   Backend health check: `http://localhost:4000/api/health`

## Environment variables

| Variable | App | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend | Neon pooled/runtime connection string. |
| `DIRECT_URL` | Backend | Neon direct connection used by Prisma migrations. |
| `JWT_ACCESS_SECRET` | Backend | Signing key; at least 32 characters. |
| `JWT_ACCESS_EXPIRES_IN` | Backend | Access-token lifetime; defaults to `15m`. |
| `REFRESH_TOKEN_EXPIRES_IN` | Backend | Refresh-token lifetime; defaults to `7d`. |
| `FRONTEND_URL` | Backend | Exact browser origin allowed by CORS (no trailing slash). |
| `PORT` | Backend | HTTP port; hosting providers set it in production. |
| `NODE_ENV` | Backend | `development`, `test`, or `production`. |
| `GROQ_API_KEY` | Backend | Groq secret; required to generate summaries. |
| `GROQ_MODEL` | Backend | Model ID; defaults to `openai/gpt-oss-120b`. |
| `VITE_API_URL` | Frontend | Backend API base URL, including `/api`. Never put secrets in Vite variables. |

The backend example file contains placeholder values only. Keep real credentials in local ignored environment files or hosting-provider secret settings.

## API overview

All endpoints are under `/api`. Board/list/card endpoints and AI summaries require a Bearer access token.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health endpoint. |
| `POST` | `/auth/register` | Register. |
| `POST` | `/auth/login` | Sign in. |
| `POST` | `/auth/refresh` | Rotate refresh session. |
| `POST` | `/auth/logout` | Revoke refresh session. |
| `GET` | `/auth/me` | Get current user. |
| `GET`, `POST` | `/boards` | List or create owned boards. |
| `GET`, `PATCH`, `DELETE` | `/boards/:boardId` | Retrieve, update, or delete an owned board. |
| `POST`, `GET` | `/boards/:boardId/lists` | Create or list board lists. |
| `PATCH`, `DELETE` | `/lists/:listId` | Update or delete a list. |
| `POST`, `GET` | `/lists/:listId/cards` | Create or list cards. |
| `GET`, `PATCH`, `DELETE` | `/cards/:cardId` | Retrieve, update, or delete a card. |
| `PATCH` | `/boards/:boardId/cards/reorder` | Persist card positions and list changes. |
| `PATCH` | `/boards/:boardId/lists/reorder` | Persist list positions. |
| `POST` | `/boards/:boardId/ai-summary` | Generate an AI board summary. |

Request bodies are validated with Zod. Ownership is checked for boards and nested list/card resources.

## AI summary implementation

The protected summary endpoint fetches a board and its ordered lists/cards through Prisma. The backend determines task status from list membership, calculates task totals and completion percentage, and identifies overdue and unfinished high-priority cards. It sends only the board details needed for analysis to Groq.

Groq generates the overview, evidence-based bottlenecks, and recommendations. Zod validates its JSON response; numeric progress, overdue tasks, and high-priority tasks always come from backend calculations rather than model output. Configure the key and model only on the backend.

## Testing and quality checks

From the repository root:

```sh
npm run build
npm test
npm run lint
```

Backend integration tests use the configured database and remove their test users afterward. The frontend lint command currently reports existing React hook warnings; a passing lint process does not mean those warnings have been eliminated. No live Groq request or deployed-browser flow is part of the automated test suite.

## Deployment preparation

Deployment manifests are included; deployment itself is not complete and no public URLs are claimed.

### Vercel frontend

The root `vercel.json` uses the repository root, runs `npm ci`, builds `apps/frontend`, publishes `apps/frontend/dist`, and rewrites SPA routes to `index.html`. Configure `VITE_API_URL` in Vercel to the deployed backend base URL including `/api` (for example, `https://<your-render-service>.onrender.com/api`).

### Render backend

The root `render.yaml` describes a free Node web service and `/api/health` check. Its build generates Prisma Client and compiles the backend. Its start command runs `prisma migrate deploy` before starting the server; this applies pending migrations without resetting existing data. The command can also be run manually from the repository root:

```sh
npm run db:migrate:deploy
```

Set `DATABASE_URL` to the Neon pooled/runtime connection and `DIRECT_URL` to the direct connection. Also set `JWT_ACCESS_SECRET`, `FRONTEND_URL` to the exact deployed Vercel origin, and `GROQ_API_KEY`. Render sets `PORT`. Do not create a replacement database or run `db push`.

Render's free service may sleep and have cold starts. Verify current free-tier requirements in the hosting dashboard before creating resources; if a payment method or paid plan is required, stop rather than upgrading.

### Remaining deployment steps

- Push this project to a public GitHub repository; this workspace currently has no Git repository or remote.
- Create the Render service and Vercel project from the manifests.
- Enter secret environment variables in the providers; never commit them.
- Use the existing Neon database and verify migration status before and after deployment.
- Set the production frontend/API origins and test CORS, cookies, registration, CRUD, drag persistence, AI, and logout on the public URLs.
- Capture application screenshots and add verified GitHub, live-demo, and Loom URLs here.

## Loom demonstration

See [the five-minute Loom script](./docs/LOOM-DEMO-SCRIPT.md). It is a presentation guide, not evidence that the video or deployment has been completed.

## Future improvements

- Add frontend component and browser-level automated tests.
- Add durable request throttling for authentication and AI endpoints.
- Replace list-title status heuristics with explicit configurable workflow statuses.
- Add board collaboration and real-time updates if the product scope expands.
