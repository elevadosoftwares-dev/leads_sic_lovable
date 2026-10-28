import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AppRole = "admin" | "viewer";

export interface SessionInfo {
  userId: string;
  email: string;
  role: AppRole;
}

/** The signed-in user, or null when nobody is signed in. */
export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionInfo | null> => {
    const { getSessionUser } = await import("@/server/auth.server");
    const user = await getSessionUser();
    return user ? { userId: user.userId, email: user.email, role: user.role } : null;
  },
);

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ email: z.string().trim().toLowerCase().min(1), password: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { verifyPassword, getDummyHash } = await import("@/server/crypto.server");
    const { createSession } = await import("@/server/auth.server");

    const req = await request();
    const { recordset } = await req
      .input("email", sql.NVarChar(320), data.email)
      .query<{ id: string; password_hash: string }>(
        `SELECT id, password_hash FROM dbo.users WHERE email = @email`,
      );
    const user = recordset[0];
    const ok = await verifyPassword(data.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) throw new Error("Invalid login credentials");

    await createSession(user.id);
    return { ok: true };
  });

/**
 * Registers a staff account with read-only (viewer) access. The very first account on an empty
 * database becomes an administrator so somebody can manage the system.
 */
export const signUp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => credentialsSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    try {
      // The lock hints make the "no users yet" check and the insert atomic.
      await req
        .input("email", sql.NVarChar(320), data.email)
        .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
        .query(
          `INSERT INTO dbo.users (email, password_hash, role)
           SELECT @email, @password_hash,
                  CASE WHEN EXISTS (SELECT 1 FROM dbo.users WITH (UPDLOCK, HOLDLOCK))
                       THEN N'viewer' ELSE N'admin' END`,
        );
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error("User already registered");
      throw error;
    }
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("@/server/auth.server");
  await destroySession();
  return { ok: true };
});
