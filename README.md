# LEADS SIC — Safety Induction Course Tracker

Register technicians, record their safety induction courses (SIC) per client site, see what is
expiring or expired, and keep each site's booking instructions in one place.

## Stack

| Layer     | Technology                                                                    |
| --------- | ----------------------------------------------------------------------------- |
| Framework | TanStack Start — React 19 with server-side rendering and **server functions** |
| UI        | TypeScript, Tailwind CSS v4, shadcn/ui (Radix), lucide icons, sonner (toasts) |
| Data (UI) | TanStack Query (caching), TanStack Router (file-based routes)                 |
| Database  | Microsoft SQL Server via the `mssql` driver                                   |
| Auth      | Own login: scrypt-hashed passwords + HTTP-only session cookie                 |
| Build     | Vite 8; Nitro packages the production build as a standalone Node.js server    |

## How it works

Frontend and backend live in **one project and run as one Node.js process**:

```
Browser (React pages)                         Node.js server
─────────────────────                         ──────────────────────────────────────────
src/routes/*.tsx  ── calls ──►  src/lib/*.functions.ts  ──►  src/server/*.server.ts ──► SQL Server
src/components/*                (server functions: run on      (DB pool, password hashing,
                                 the server; the browser gets   sessions — never sent
                                 only a tiny fetch stub)        to the browser)
```

- **Login:** `signIn` checks the password hash, stores a random token's SHA-256 in
  `dbo.sessions`, and sets it in an HTTP-only cookie (`sic_session`, 30 days, renewed on use).
- **Access rules:** every signed-in user can view everything; only **admins** can add, edit or
  delete sites, technicians, departments, SIC records and booking instructions, and manage users.
  **Viewers** are read only. Enforced on the server by `requireAuth` / `requireAdmin`
  (`src/lib/auth-middleware.ts`); the UI hides edit buttons via `useIsAdmin()`. At least one
  admin always remains.
- **Files** (site images, technician photos, attachments) are stored in SQL Server
  (`dbo.files`, max 20 MB each) and served by `GET /api/files/:id` to signed-in users only.
  Files no record points to any more are removed automatically a day later.
- **Database setup is automatic:** on the first request the server connects to `DATABASE_URL`,
  creates the database if it does not exist, applies `database/schema.sql` (idempotent) and
  inserts the starter sites, technicians, departments and SIC records once. The sign-in page
  then asks you to create the first admin account; further accounts are added on the Users page.

## Files

| File                                    | Purpose                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| `database/schema.sql`                   | SQL Server tables + starter data; applied at startup        |
| `src/server/db.server.ts`               | Parses `DATABASE_URL`, connection pool, creates DB + schema |
| `src/server/crypto.server.ts`           | Password hashing (scrypt), session tokens                   |
| `src/server/auth.server.ts`             | Create / read / destroy login sessions                      |
| `src/lib/auth-middleware.ts`            | `requireAuth` / `requireAdmin` guards for server functions  |
| `src/lib/auth.functions.ts`             | Sign in/out, current session, first-admin setup             |
| `src/lib/users.functions.ts`            | Admin: list, create, change role, reset password, delete    |
| `src/lib/sites.functions.ts`            | Sites: list, save, delete                                   |
| `src/lib/employees.functions.ts`        | Technicians and departments                                 |
| `src/lib/sic.functions.ts`              | SIC records: list, register (several technicians), delete   |
| `src/lib/bookings.functions.ts`         | Booking instructions: list, save, delete                    |
| `src/lib/files.functions.ts`            | File upload                                                 |
| `src/routes/api/files/$id.ts`           | Serves an uploaded file                                     |
| `src/lib/data.ts`                       | React Query options and hooks used by the pages             |
| `src/lib/sic.ts`                        | SIC status (valid / expiring in 30 days / expired), CSV     |
| `src/routes/`                           | Pages: `/auth`, `/dashboard`, `/finder`, `/sic`, `/expiring`, `/technicians`, `/sites`, `/bookings`, `/users` |

## Configuration (`.env`)

| Variable                | Purpose                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `sqlserver://HOST[\INSTANCE][:PORT];database=NAME;user=...;password=...;encrypt=true;trustServerCertificate=true` |
| `SESSION_COOKIE_SECURE` | `true` when the site is served over HTTPS                                                                         |
| `PORT` (optional)       | Port to listen on (default 3000)                                                                                  |

Copy `.env.example` to `.env` and fill it in. The SQL login needs `CREATE DATABASE`
permission the first time if the database does not exist yet (`sa` has it).

## Run locally

Requires Node.js 20.12 or newer.

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but
not `node_modules` or the source) and run `npm start` there. Keep it running with pm2 or as a
Windows service (e.g. NSSM), and put IIS (URL Rewrite + ARR) or nginx in front for HTTPS;
then set `SESSION_COOKIE_SECURE=true`.

## Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm test`       | Run the unit tests (Vitest)        |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
