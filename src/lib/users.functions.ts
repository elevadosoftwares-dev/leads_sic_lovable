import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-middleware";
import { MIN_PASSWORD_LENGTH, type AppRole } from "@/lib/auth.functions";

export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
}

const roleSchema = z.enum(["admin", "viewer"]);
const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AppUser[]> => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<AppUser>(
      `SELECT id, email, role FROM dbo.users ORDER BY email`,
    );
    return recordset.map((u) => ({ ...u, id: u.id.toLowerCase() }));
  });

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: passwordSchema,
  role: roleSchema,
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    try {
      await req
        .input("email", sql.NVarChar(320), data.email)
        .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
        .input("role", sql.NVarChar(10), data.role)
        .query(
          `INSERT INTO dbo.users (email, password_hash, role) VALUES (@email, @password_hash, @role)`,
        );
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new Error("A user with this email address has already been registered");
      throw error;
    }
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: roleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You can't change your own access");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    // Demoting is refused when it would leave no administrator; the lock hints make the
    // admin count and the update atomic.
    const { rowsAffected } = await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("role", sql.NVarChar(10), data.role)
      .query(
        `UPDATE dbo.users SET role = @role
          WHERE id = @id
            AND (@role = N'admin'
                 OR role <> N'admin'
                 OR (SELECT COUNT(*) FROM dbo.users WITH (UPDLOCK, HOLDLOCK) WHERE role = N'admin') > 1)`,
      );
    if (!rowsAffected[0]) throw new Error("There must be at least one admin.");
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You can't remove your own account");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    // The user's sessions are removed with it (ON DELETE CASCADE).
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .query(`DELETE FROM dbo.users WHERE id = @id`);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: passwordSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    // Signs the user out everywhere, except an admin resetting their own password.
    const { rowsAffected } = await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .input("keep_sessions", sql.Bit, data.userId.toLowerCase() === context.user.userId)
      .query(
        `UPDATE dbo.users SET password_hash = @password_hash WHERE id = @id;
         IF @keep_sessions = 0 DELETE FROM dbo.sessions WHERE user_id = @id;`,
      );
    if (!rowsAffected[0]) throw new Error("This user no longer exists.");
    return { ok: true };
  });
