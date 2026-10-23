import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import { idSchema, lowerId, lowerIdOrNull, optionalIdSchema } from "@/lib/rows";

export interface Site {
  id: string;
  name: string;
  image_id: string | null;
}

export const listSites = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Site[]> => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<Site>(
      `SELECT id, name, image_id FROM dbo.sites ORDER BY name`,
    );
    return recordset.map((s) => ({ ...s, id: lowerId(s.id), image_id: lowerIdOrNull(s.image_id) }));
  });

const saveSiteSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Site name is required").max(300),
  image_id: optionalIdSchema,
});

export const saveSite = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: z.input<typeof saveSiteSchema>) => saveSiteSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    req
      .input("name", sql.NVarChar(300), data.name)
      .input("image_id", sql.UniqueIdentifier, data.image_id);
    if (data.id) {
      const { rowsAffected } = await req
        .input("id", sql.UniqueIdentifier, data.id)
        .query(`UPDATE dbo.sites SET name = @name, image_id = @image_id WHERE id = @id`);
      if (!rowsAffected[0]) throw new Error("This site no longer exists.");
    } else {
      await req.query(`INSERT INTO dbo.sites (name, image_id) VALUES (@name, @image_id)`);
    }
    return { ok: true };
  });

/** Deletes a site together with its SIC records and booking instructions (ON DELETE CASCADE). */
export const deleteSite = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req.input("id", sql.UniqueIdentifier, data.id).query(`DELETE FROM dbo.sites WHERE id = @id`);
    return { ok: true };
  });
