# Phase 1 Authentication Architecture

This document explains how the current frontend, Express backend, and Neon/PostgreSQL database work together in Phase 1.

## 1. System overview

```mermaid
flowchart LR
    UI[React registration/login/dashboard] --> API[Reusable fetch API client]
    API --> CORS[Express CORS and JSON middleware]
    CORS --> ROUTES[Auth routes]
    ROUTES --> VALIDATE[Zod validation]
    VALIDATE --> CONTROLLER[Auth controller]
    CONTROLLER --> SERVICE[Auth service]
    SERVICE --> PRISMA[Prisma ORM]
    PRISMA --> DB[(Neon PostgreSQL)]

    CONTROLLER --> COOKIE[HttpOnly refresh cookie]
    API --> BEARER[Bearer access token]
```

The frontend never connects directly to PostgreSQL. React sends requests to Express, Express performs validation and business logic, and Prisma is the only database-access layer.

## 2. Main project modules

### Frontend

| Module | Responsibility |
|---|---|
| `src/pages/RegisterPage.tsx` | Collects and validates registration form input. Calls the auth context. |
| `src/pages/LoginPage.tsx` | Collects and validates login form input. Calls the auth context. |
| `src/context/AuthContext.tsx` | Stores the current user and access token in React memory. Restores sessions and provides login, register, and logout actions. |
| `src/services/api.ts` | Sends requests to `VITE_API_URL`, adds the Bearer access token, and includes cookies. |
| `src/components/ProtectedRoute.tsx` | Redirects unauthenticated users to `/login` and authenticated users away from public auth pages. |
| `src/pages/DashboardPage.tsx` | Displays the authenticated user's name and logout action. |

Important frontend behavior: the access token is stored only in React memory. Reloading the page clears it. The auth context calls `/api/auth/refresh` to obtain a new access token using the HttpOnly refresh cookie.

### Backend

| Module | Responsibility |
|---|---|
| `src/app.ts` | Configures Express, CORS, JSON parsing, cookies, routes, and centralized errors. |
| `src/routes/index.ts` | Mounts `/api/health` and `/api/auth`. |
| `src/modules/auth/auth.routes.ts` | Maps authentication endpoints to middleware and controllers. |
| `src/modules/auth/auth.schemas.ts` | Defines Zod validation for registration and login. |
| `src/middleware/validate.ts` | Runs Zod validation and returns normalized request data or a 400 error. |
| `src/modules/auth/auth.controller.ts` | Converts service results into HTTP responses and manages the refresh cookie. |
| `src/modules/auth/auth.service.ts` | Implements registration, login, session creation, refresh rotation, and logout. |
| `src/middleware/authenticate.ts` | Verifies access JWTs for protected endpoints. |
| `src/modules/users/user.service.ts` | Reads public user information by ID through Prisma. |
| `src/utils/crypto.ts` | Creates cryptographically random refresh tokens and hashes them with SHA-256. |
| `src/lib/prisma.ts` | Creates the shared Prisma client. |

## 3. Database models

### User

```text
id            UUID
name          String
email         Unique String
passwordHash  Argon2id String
createdAt     DateTime
updatedAt     DateTime
refreshTokens RefreshToken[]
```

Passwords are never stored as plaintext. Registration creates `passwordHash` using Argon2id.

### RefreshToken

```text
id        UUID
userId    Foreign key to User
tokenHash Unique SHA-256 hash
expiresAt DateTime
revokedAt Optional DateTime
createdAt DateTime
```

The refresh token plaintext is sent to the browser only inside an HttpOnly cookie. PostgreSQL stores only `tokenHash`, never the browser-facing refresh-token value.

Deleting a user cascades to its refresh sessions.

## 4. Example registration flow

Suppose a user submits:

```json
{
  "name": "John Smith",
  "email": "John@Example.com",
  "password": "StrongPassword123!"
}
```

### Step 1 — Registration page

`RegisterPage.handleSubmit` calls:

```text
register(name, email, password)
```

The auth context method calls:

```text
POST /api/auth/register
```

The request body is sent with `credentials: "include"` so the browser can accept the refresh cookie.

### Step 2 — Route and validation

The Express route in `auth.routes.ts` is:

```text
POST /api/auth/register
  -> validate(registerSchema)
  -> registerController
```

`registerSchema` trims and normalizes the email to lowercase, validates the name, and enforces password complexity.

For this example, the normalized request becomes:

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

### Step 3 — Controller to service

`registerController` passes the normalized body to:

```text
register(input)
```

### Step 4 — Duplicate check and password hashing

`auth.service.register`:

1. Searches for `john@example.com` using Prisma.
2. Rejects the request with `409` if the email already exists.
3. Hashes the password using:

```text
argon2.hash(password, { type: argon2.argon2id })
```

4. Creates a `User` through Prisma.

The database receives no plaintext password. It receives a value such as an Argon2id encoded hash, not the original password.

### Step 5 — Create both tokens

`createSession(user)`:

1. Creates a 48-byte random refresh token with `crypto.randomBytes(...).toString("base64url")`.
2. Hashes the refresh token with SHA-256.
3. Saves the hash and expiration in the `RefreshToken` table.
4. Signs a short-lived JWT access token for the user ID.
5. Returns the access token, raw refresh token, and public user information.

The access token contains:

```text
header  -> algorithm and token type
payload -> sub: user UUID
          exp: expiration timestamp
signature -> HMAC signature using JWT_ACCESS_SECRET
```

The access token is not stored by the backend. The refresh-token hash is stored by the backend.

### Step 6 — Response and cookie

`setRefreshCookie` sends `refresh_token` as:

```text
HttpOnly
Secure in production
SameSite=None in production
SameSite=Lax in development
Path=/api/auth
```

The JSON response contains:

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "name": "John Smith",
      "email": "john@example.com"
    },
    "accessToken": "jwt-access-token"
  }
}
```

JavaScript cannot read the refresh cookie. It can read the access token from the JSON response and stores it in the auth context's React state.

## 5. Example sign-in flow

Suppose John now submits:

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

The login flow is:

```text
LoginPage
  -> AuthContext.login
  -> POST /api/auth/login
  -> validate(loginSchema)
  -> loginController
  -> authService.login
  -> Prisma lookup
  -> Argon2 password verification
  -> createSession
  -> set refresh cookie
  -> access token response
```

`authService.login` finds the user, but deliberately uses the generic error:

```text
Invalid email or password
```

This is returned for both nonexistent accounts and incorrect passwords, preventing account enumeration.

If verification succeeds, the system creates a new refresh-token session and a new access token, just as it did during registration.

## 6. Access tokens

### Purpose

Access tokens authorize protected API operations, such as `GET /api/auth/me`.

They are short-lived, typically controlled by:

```text
JWT_ACCESS_EXPIRES_IN=15m
```

### Request

A protected request is sent as:

```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

`apiRequest` automatically adds this header when an access token is available.

### Verification

`authenticateUser`:

1. Reads the `Authorization` header.
2. Requires the `Bearer ` prefix.
3. Calls `jwt.verify` using `JWT_ACCESS_SECRET`.
4. Reads the user ID from the JWT `sub` claim.
5. Finds the user through Prisma.
6. Attaches `req.user` for downstream handlers.

Missing, malformed, signed-with-the-wrong-secret, or expired access tokens return:

```json
{
  "success": false,
  "message": "Invalid or expired access token"
}
```

or `Authentication required` for a missing header.

The backend never trusts a user ID supplied in the request body. The user ID comes from the verified JWT subject claim.

## 7. Refresh tokens

### Purpose

A refresh token is a long-lived credential used only to obtain a new access token after the access token expires or after a browser refresh.

The configured lifetime comes from:

```text
REFRESH_TOKEN_EXPIRES_IN=7d
```

### Why there are two token types

| Access token | Refresh token |
|---|---|
| Short-lived | Longer-lived |
| Sent as an Authorization header | Sent automatically in an HttpOnly cookie |
| Used for protected API calls | Used only to refresh sessions |
| Stored in React memory | Raw value stored only in browser cookie; database stores hash |
| Stateless JWT signature verification | Database-backed and can be revoked |

## 8. Refresh flow

On initial page load, `AuthProvider.restoreSession` calls:

```text
POST /api/auth/refresh
```

The browser includes the HttpOnly refresh cookie automatically because `credentials: "include"` is enabled.

The backend flow is:

```text
refreshController
  -> refresh(rawRefreshToken)
  -> hash refresh token
  -> find matching RefreshToken row
  -> verify it is not revoked or expired
  -> transaction:
       revoke old row
       create replacement row with replacement token hash
  -> return new access and refresh tokens
  -> set replacement refresh cookie
```

This is called token rotation.

The old refresh token becomes invalid when its database row is marked `revokedAt`. The response receives a new access token and browser cookie.

### Example

```text
Current refresh token: RT-1
Database hash: H(RT-1)
Cookie: RT-1

POST /api/auth/refresh

Database transaction:
  H(RT-1) revoked
  H(RT-2) created

Browser cookie: RT-2
New access JWT: AT-2
```

If the refresh cookie is missing, expired, revoked, or unknown, the backend returns `401 Refresh session expired`.

## 9. Reuse of revoked refresh tokens

If an attacker or stale client sends a previously revoked token, `refresh` finds a row with `revokedAt` set.

The implementation responds by revoking every active refresh-token row for that user:

```text
where userId = compromised user
and revokedAt is null
```

This is a security measure that forces re-login across the user's sessions.

## 10. Logout flow

`AuthContext.logout` calls:

```text
POST /api/auth/logout
Authorization: Bearer <access-token>
```

The logout endpoint is not yet protected by `authenticateUser`; it uses the refresh cookie instead. `logoutController` calls:

```text
logout(req.cookies["refresh_token"])
```

The service hashes the raw cookie value and revokes matching database rows. The controller also clears the cookie by using `res.clearCookie`.

Finally, the auth context clears React's user and access-token state and redirects to `/login`.

## 11. Protected dashboard flow

After login or session restoration:

```text
AuthContext has user
  -> ProtectedRoute allows /dashboard
  -> DashboardPage reads user.name
```

If no session is restored:

```text
AuthContext user is null
  -> ProtectedRoute redirects to /login
```

The protected route performs a frontend UX redirect, while `authenticateUser` performs the real security check on protected backend endpoints.

## 12. Complete request examples

### Registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

### Protected user lookup

```http
GET /api/auth/me
Authorization: Bearer <access-token>
```

### Refresh

```http
POST /api/auth/refresh
Cookie: refresh_token=<raw-refresh-token>
```

### Logout

```http
POST /api/auth/logout
Cookie: refresh_token=<raw-refresh-token>
```

## 13. Security boundaries

- Password hashes use Argon2id.
- JWTs are signed and their signatures and expirations are verified.
- Refresh tokens are random, hashed in PostgreSQL, and rotated.
- Authentication middleware derives identity from the verified JWT subject.
- Login errors do not reveal whether an email exists.
- CORS accepts only `FRONTEND_URL` with credentials.
- The refresh cookie is HttpOnly and uses HTTPS-only security in production.
- Zod validates request bodies before services execute.
- Database credentials and JWT secrets remain in environment variables.

## 14. Known Phase 1 limitation

The access token is not automatically retried after it expires. A future protected API call will receive `401`, and the frontend does not yet have a centralized retry-and-refresh mechanism. Browser startup currently restores the session by refreshing once.
