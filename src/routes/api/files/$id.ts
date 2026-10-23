import { createFileRoute } from "@tanstack/react-router";

const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);

// Streams an uploaded file (site image, technician photo, attachment) to a signed-in user.
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getSessionUser } = await import("@/server/auth.server");
        if (!(await getSessionUser())) return new Response("Unauthorized", { status: 401 });

        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });

        const { request, sql } = await import("@/server/db.server");
        const req = await request();
        const { recordset } = await req.input("id", sql.UniqueIdentifier, params.id).query<{
          file_name: string;
          content_type: string;
          data: Buffer;
        }>(`SELECT file_name, content_type, data FROM dbo.files WHERE id = @id`);
        const file = recordset[0];
        if (!file) return new Response("Not found", { status: 404 });

        // Only open known-safe types in the browser; anything else (HTML, SVG, ...) could run
        // script on this origin, so it is sent as a plain download.
        const type = file.content_type.toLowerCase();
        const inline = INLINE_TYPES.has(type);
        return new Response(new Uint8Array(file.data), {
          headers: {
            "content-type": inline ? type : "application/octet-stream",
            "content-length": String(file.data.length),
            "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
            "x-content-type-options": "nosniff",
            // Files never change once uploaded (a replacement gets a new id).
            "cache-control": "private, max-age=86400",
          },
        });
      },
    },
  },
});
