# LEADS SIC — Safety Induction Course tracker

Tracks which technicians hold a valid safety induction course (SIC) for which client site,
warns about expiring passes, and keeps each site's booking instructions.

## Stack

| Layer     | Technology                                                                    |
| --------- | ----------------------------------------------------------------------------- |
| Framework | TanStack Start — React 19 with server-side rendering and **server functions** |
| UI        | TypeScript, Tailwind CSS v4, shadcn/ui (Radix), lucide icons                  |
| Data (UI) | TanStack Query (caching), TanStack Router (file-based routes)                 |
| Database  | Microsoft SQL Server via the `mssql` driver                                   |
| Auth      | Own login: scrypt-hashed passwords + HTTP-only session cookie                 |
| Build     | Vite 8; Nitro packages the production build as a standalone Node.js server    |

## How it works

Frontend and backend live in **one project and run as one Node.js process** — there is no
separate API server:

```
Browser (React pages)                         Node.js server
─────────────────────                         ──────────────────────────────────────────
src/routes/*.tsx  ── calls ──►  src/lib/*.functions.ts  ──►  src/server/*.server.ts ──► SQL Server
src/components/*                (server functions: run on      (DB pool, passwords,
                                 the server; the browser gets   sessions, files — never
                                 only a tiny fetch stub)        sent to the browser)
```

- **Accounts:** anyone can register on the sign-in page. The very first account becomes an
  **admin**; later sign-ups are **viewers** (read-only). Admins manage accounts and roles in
  **Users** (create, change role, reset password, remove).
- **Access rules:** every server function requires a signed-in user; all adds, edits and deletes
  require an admin (`requireAdmin` in `src/lib/auth-middleware.ts`).
- **Pictures and attachments** (site images, technician photos, SIC/booking files) are stored in
  the `dbo.files` table and served to signed-in users by `/api/files/...`.
- **Database setup is automatic:** on the first request the server connects to `DATABASE_URL`,
  creates the database if it does not exist and applies `database/schema.sql` (idempotent, safe
  on every start). An empty database is filled with the sites, technicians, departments, SIC records and booking instructions from the original system.

## Files

| File                          | Purpose                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `database/schema.sql`         | SQL Server tables (users, sessions, files, departments, sites, employees, sic_records, booking_instructions); applied automatically at startup |
| `src/server/db.server.ts`     | Parses `DATABASE_URL`, connection pool, creates the database and applies the schema                                                            |
| `src/server/auth.server.ts`   | Create / read / destroy login sessions (cookie + `dbo.sessions`)                                                                               |
| `src/server/crypto.server.ts` | Password hashing (scrypt) and session tokens                                                                                                   |
| `src/server/rows.server.ts`   | Query helpers (JSON results, insert/update/delete rows)                                                                                        |
| `src/lib/auth-middleware.ts`  | `requireAuth` / `requireAdmin` guards for server functions                                                                                     |
| `src/lib/sic.functions.ts`    | Sites, technicians, departments, SIC records, bookings, uploads                                                                                |
| `src/lib/users.functions.ts`  | Users: create, change role, reset password, remove (admin)                                                                                     |
| `src/lib/auth.functions.ts`   | Sign in / sign up / sign out / current session                                                                                                 |
| `src/lib/data.ts`             | React Query hooks used by the pages                                                                                                            |
| `src/server/files.server.ts`  | Store / read uploaded files (dbo.files)                                                                                                        |
| `src/routes/api/files/$.ts`   | `/api/files/...` — streams an uploaded file to a signed-in user                                                                                |
| `src/routes/*`                | Pages (file-based routes); `src/routeTree.gen.ts` is generated — do not edit                                                                   |
| `src/start.ts, src/server.ts` | Request middleware (errors, CSRF protection) and server entry                                                                                  |

## Configuration (`.env`)

Copy `.env.example` to `.env` and fill it in.

| Variable                | Purpose                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `sqlserver://HOST[\INSTANCE][:PORT];database=new_leads_sic;user=...;password=...;encrypt=true;trustServerCertificate=true` |
| `SESSION_COOKIE_SECURE` | `true` when the site is served over HTTPS                                                                                  |
| `PORT` (optional)       | Port to listen on (default 3000)                                                                                           |

The SQL login needs `CREATE DATABASE` permission the first time (`sa` has it) unless you create
the database yourself.

## Run locally

Requires Node.js 22 or newer and a reachable SQL Server.

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but not
`node_modules` or the source) and run `npm start`. Keep it running with pm2
(`pm2 start npm --name leads-sic -- start`) or as a Windows service (e.g. NSSM), and put IIS
(URL Rewrite + ARR) or nginx in front for HTTPS; then set `SESSION_COOKIE_SECURE=true`.

## Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm test`       | Unit tests (Vitest)                |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
