# Phase 4 — AI-Powered Board Summary

## Overview

Phase 4 adds an AI-generated summary for a board. A board owner can open a board and click **Generate AI Summary**. The React frontend sends an authenticated request to the Express backend. The backend retrieves the actual board data from Neon PostgreSQL through Prisma, calculates reliable statistics, sends the relevant board information to Groq, validates the response, and renders a structured summary.

The implementation does not store AI responses in browser storage or database storage.

## Files created

- `apps/backend/src/modules/ai/ai.prompt.ts`
- `apps/backend/src/modules/ai/ai.service.ts`
- `apps/backend/src/modules/ai/ai.validation.ts`
- `apps/backend/tests/phase4.test.ts`
- `docs/PHASE-4-AI-BOARD-SUMMARY.md`

## Files modified

- `apps/backend/src/config/env.ts` — added Groq environment variables.
- `apps/backend/.env.example` — added Groq configuration placeholders.
- `apps/backend/src/modules/boards/board.routes.ts` — registered the summary endpoint.
- `apps/backend/src/modules/boards/board.controller.ts` — added the board-summary controller.
- `apps/frontend/src/services/boardService.ts` — added summary types and the API request.
- `apps/frontend/src/pages/BoardDragPage.tsx` — added summary loading, empty, error, retry, and success UI.

No database schema migration was needed because the summary uses existing board, list, and card data.

## Dependencies

No new package dependency was installed. Groq is called through the Node.js built-in `fetch` API against the official Groq OpenAI-compatible chat-completions endpoint.

Existing relevant dependencies remain:

- Express
- Prisma
- Zod
- React
- Tailwind CSS

## Groq configuration

Add the following values to `apps/backend/.env`:

```env
GROQ_API_KEY="your_groq_api_key"
GROQ_MODEL="openai/gpt-oss-120b"
```

The placeholder configuration is documented in `apps/backend/.env.example`.

- `GROQ_API_KEY` is required when a summary is generated.
- `GROQ_MODEL` defaults to `openai/gpt-oss-120b`.
- The API key exists only in backend environment configuration.
- The frontend never receives or exposes the API key.
- Groq is never called directly from React.

If the key is missing, the endpoint returns a clear `503` configuration error.

## API endpoint

```http
POST /api/boards/:boardId/ai-summary
Authorization: Bearer <access-token>
```

The endpoint uses the existing authentication middleware and board ownership service.

Success response:

```json
{
  "success": true,
  "message": "AI summary generated",
  "data": {
    "overview": "The project is progressing with several tasks still pending.",
    "progress": {
      "totalTasks": 10,
      "completed": 4,
      "inProgress": 3,
      "pending": 3,
      "completionPercentage": 40
    },
    "highPriorityTasks": [],
    "overdueTasks": [],
    "bottlenecks": [],
    "recommendedActions": []
  }
}
```

## Board data retrieval

The backend first calls the existing board service with the board ID and authenticated user ID. This performs an ownership lookup and returns `404 Board not found` for a missing board or a board owned by another user.

The board is retrieved with Prisma using its existing schema, including:

- Ordered lists
- Ordered cards
- Card title and description
- Card priority
- Card due date
- Card labels
- List title and position

Data comes from Neon PostgreSQL through Prisma. Deleted cards and unrelated boards are not included.

## Status classification

The application does not assume that a list must be named `To Do`, `In Progress`, or `Done`.

List titles are inspected for completion or activity keywords:

- Completed: titles containing terms such as `done`, `complete`, `completed`, `closed`, `resolved`, `published`, `shipped`, `deployed`, or `archive`.
- In progress: titles containing terms such as `in progress`, `doing`, `active`, `working`, `review`, `testing`, `qa`, or `blocked`.
- Pending: all other list titles.

This is only a project-summary classification. It does not change or rewrite the stored list or card records.

## Backend-computed statistics

The backend, not Groq, calculates:

- Total tasks
- Completed tasks
- In-progress tasks
- Pending tasks
- Completion percentage
- Unfinished high-priority tasks
- Overdue unfinished tasks

Completion percentage is:

```text
round(completed / total tasks * 100)
```

The result is `0` for a board with no tasks.

For overdue calculation:

- The server's current date is used.
- A card must have a due date.
- A card must belong to a non-completed list.
- The due date must be before the server date.

Cards with missing due dates are never marked overdue. Completed-list cards are not included in overdue or unfinished high-priority results.

## Prompt construction

The dedicated prompt module builds a system prompt and user prompt.

The system prompt instructs Groq to:

- Analyze only the supplied board data.
- Not invent tasks, deadlines, progress, or project details.
- Use list membership to interpret status.
- Identify supported bottlenecks.
- Include supporting evidence.
- Suggest practical next actions.
- State when insufficient information is available.
- Return JSON only.

The user prompt contains:

- Board title and description
- Server date
- Preserved list order
- List names and status classifications
- Card title, description, priority, due date, and labels
- Backend-computed statistics
- Backend-calculated overdue tasks
- Backend-calculated high-priority tasks

Authentication tokens and unrelated database records are not sent to Groq.

## Groq API call

The service sends a POST request to:

```text
https://api.groq.com/openai/v1/chat/completions
```

The request includes:

- Bearer authorization using `GROQ_API_KEY`
- The configured `GROQ_MODEL`
- Low temperature for consistent output
- JSON-object response formatting
- The system and board-data prompts

The provider request has a 20-second timeout.

Provider failures are handled as:

- Missing key: `503`
- Timeout: `504`
- Rate limit: `429`
- Provider connection failure: `502`
- Provider HTTP failure: `502`
- No response content: `502`
- Malformed JSON: `502`
- Invalid response structure: `502`

Provider responses are not logged, and the API key is never logged.

## AI response validation

Zod validates the provider JSON with this structure:

- `overview`: non-empty string
- `bottlenecks`: array of objects with `issue` and `evidence`
- `recommendedActions`: array of strings

The length of every narrative field is bounded.

Numeric progress values returned by Groq are ignored. The final response always uses the backend-computed progress object.

High-priority and overdue tasks are also assembled by the backend. Groq does not control these arrays.

## Frontend integration

The frontend is implemented in `BoardDragPage.tsx`.

The summary panel includes:

- Project Overview
- Progress Overview
- Total, completed, in-progress, and pending counts
- Completion percentage and progress bar
- High-Priority Tasks
- Overdue Tasks
- Potential Bottlenecks
- Recommended Next Actions

UI states:

- Loading: the generate button is disabled and a progress message is shown.
- Empty: the user is prompted to generate an initial summary.
- Success: the structured summary is rendered.
- Error: the provider/API error is displayed.
- Retry: a retry button calls the endpoint again.

The panel is responsive and does not interfere with the existing board drag-and-drop layout.

## Example request lifecycle

For a board named **Website Development**:

1. The user opens `/boards/:boardId`.
2. React loads the board and its lists/cards.
3. The user clicks **Generate AI Summary**.
4. `boardService.generateSummary` sends `POST /api/boards/:boardId/ai-summary` with the JWT.
5. Express authenticates the request.
6. Prisma verifies the board belongs to the authenticated user.
7. Prisma retrieves board, ordered lists, and ordered cards from Neon PostgreSQL.
8. The backend calculates progress, overdue tasks, and high-priority tasks.
9. The dedicated prompt module combines that data with the server date.
10. The backend sends the prompt through the Groq API.
11. Groq returns narrative analysis and recommendations.
12. Zod validates the response.
13. Backend statistics replace any numeric LLM output.
14. Express returns the normalized summary.
15. React renders the overview, progress, risks, and actions.

## Backend-computed data versus Groq insights

Backend-computed:

- Task counts
- Completion percentage
- Status totals
- Overdue task list
- High-priority unfinished task list
- Current server date
- Board ownership

Groq-generated:

- Project overview narrative
- Bottleneck issue descriptions
- Bottleneck evidence wording
- Practical recommended actions

The generated narrative is constrained to the supplied board data.

## Security and error handling

- JWT authentication protects the endpoint.
- Board ownership is checked before retrieval and provider calls.
- Another user's board returns `404 Board not found`.
- API keys remain in backend environment variables.
- Groq calls originate only from Express.
- Provider output is validated using Zod.
- Provider request timeouts prevent indefinite waits.
- Provider and network errors are converted to useful HTTP responses.
- Browser storage is not used for credentials or AI responses.
- Existing centralized Express error handling is preserved.

## Testing

Phase 4 added focused tests for:

- Valid structured AI response validation
- Rejection of malformed AI output
- Prompt inclusion of supplied board facts
- Prompt anti-invention instructions

The existing suite also covers authentication, board CRUD, card/list CRUD, ordering, and drag-and-drop persistence.

Verification completed:

- `npm run build` — backend and frontend builds pass.
- `npm test` — **7 test files pass with 31 tests**.

Browser testing with a live Groq key is still required to verify an actual provider response.

## Known limitations

- No explicit `completed`/`inProgress` field exists in the Prisma schema, so status classification depends on list-title keywords.
- Custom list names may be classified conservatively as pending.
- Groq output quality depends on the selected model and board-data volume.
- There is no persistent AI-response cache or per-user repeated-request rate limit.
- Groq does not receive a full card ID or list ID, reducing unnecessary sensitive data in provider requests.
