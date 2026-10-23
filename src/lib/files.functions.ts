import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/auth-middleware";

/** Largest file accepted on upload. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** URL that serves an uploaded file to signed-in users. */
export function fileUrl(id: string | null | undefined) {
  return id ? `/api/files/${id}` : null;
}

/**
 * Stores an uploaded file and returns its id, which the caller then saves on a site, technician,
 * SIC record or booking instruction. Takes FormData with a single `file` entry.
 */
export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data.");
    return d;
  })
  .handler(async ({ data: form }): Promise<{ id: string }> => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Please choose a file.");
    if (file.size > MAX_FILE_BYTES)
      throw new Error(`The file must be ${MAX_FILE_BYTES / 1024 / 1024} MB or smaller.`);

    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req
      .input("file_name", sql.NVarChar(260), file.name.slice(-260) || "file")
      .input("content_type", sql.NVarChar(200), file.type || "application/octet-stream")
      .input("data", sql.VarBinary(sql.MAX), Buffer.from(await file.arrayBuffer()))
      .query<{ id: string }>(
        `INSERT INTO dbo.files (file_name, content_type, data)
         OUTPUT inserted.id
         VALUES (@file_name, @content_type, @data);

         -- Clean up files nothing refers to any more (replaced or deleted). Files younger than a
         -- day are kept, because a just-uploaded file is saved on its row right after this call.
         DELETE f FROM dbo.files f
          WHERE f.created_at < DATEADD(DAY, -1, SYSUTCDATETIME())
            AND NOT EXISTS (SELECT 1 FROM dbo.sites WHERE image_id = f.id)
            AND NOT EXISTS (SELECT 1 FROM dbo.employees WHERE image_id = f.id)
            AND NOT EXISTS (SELECT 1 FROM dbo.sic_records WHERE attachment_id = f.id)
            AND NOT EXISTS (SELECT 1 FROM dbo.booking_instructions WHERE attachment_id = f.id);`,
      );
    const row = recordset[0];
    if (!row) throw new Error("The file could not be saved.");
    return { id: row.id.toLowerCase() };
  });
