import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/auth-middleware";

type Role = "admin" | "viewer";

function validatePassword(password: string) {
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
}

function validateUserId(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId ?? "")) throw new Error("Missing user");
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { email: string; password: string; role: Role }) => {
    if (!/^\S+@\S+\.\S+$/.test(d.email)) throw new Error("Invalid email");
    validatePassword(d.password);
    if (d.role !== "admin" && d.role !== "viewer") throw new Error("Invalid role");
    return { ...d, email: d.email.trim().toLowerCase() };
  })
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
  .inputValidator((d: { userId: string; role: Role }) => {
    validateUserId(d.userId);
    if (d.role !== "admin" && d.role !== "viewer") throw new Error("Invalid role");
    return d;
  })
  .handler(async ({ data }) => {
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
  .inputValidator((d: { userId: string }) => {
    validateUserId(d.userId);
    return d;
  })
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You can't remove your own account");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .query(`DELETE FROM dbo.users WHERE id = @id`);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; password: string }) => {
    validateUserId(d.userId);
    validatePassword(d.password);
    return d;
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    // Also signs the user out everywhere, so the old password stops working immediately.
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(
        `UPDATE dbo.users SET password_hash = @password_hash WHERE id = @id;
         DELETE FROM dbo.sessions WHERE user_id = @id;`,
      );
    return { ok: true };
  });
