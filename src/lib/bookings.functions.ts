import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import { idSchema, lowerId, lowerIdOrNull, optionalIdSchema, optionalText } from "@/lib/rows";

export interface Booking {
  id: string;
  site_id: string;
  contact_person: string;
  email: string;
  mobile: string;
  sic_session: string | null;
  remarks: string | null;
  note: string | null;
  attachment_id: string | null;
  site: { id: string; name: string };
}

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Booking[]> => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<Omit<Booking, "site"> & { site_name: string }>(
      `SELECT b.id, b.site_id, b.contact_person, b.email, b.mobile, b.sic_session, b.remarks, b.note,
              b.attachment_id, s.name AS site_name
         FROM dbo.booking_instructions b JOIN dbo.sites s ON s.id = b.site_id
        ORDER BY b.created_at DESC`,
    );
    return recordset.map(({ site_name, ...b }) => {
      const site_id = lowerId(b.site_id);
      return {
        ...b,
        id: lowerId(b.id),
        site_id,
        attachment_id: lowerIdOrNull(b.attachment_id),
        site: { id: site_id, name: site_name },
      };
    });
  });

const saveBookingSchema = z.object({
  id: idSchema.optional(),
  site_id: idSchema,
  contact_person: z.string().trim().min(1, "Contact person is required").max(300),
  email: z.string().trim().email("Invalid email").max(320),
  mobile: z.string().trim().min(1, "Mobile is required").max(50),
  sic_session: optionalText(500),
  remarks: optionalText(4000),
  note: optionalText(4000),
  attachment_id: optionalIdSchema,
});

export const saveBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: z.input<typeof saveBookingSchema>) => saveBookingSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    req
      .input("site_id", sql.UniqueIdentifier, data.site_id)
      .input("contact_person", sql.NVarChar(300), data.contact_person)
      .input("email", sql.NVarChar(320), data.email)
      .input("mobile", sql.NVarChar(50), data.mobile)
      .input("sic_session", sql.NVarChar(500), data.sic_session)
      .input("remarks", sql.NVarChar(sql.MAX), data.remarks)
      .input("note", sql.NVarChar(sql.MAX), data.note)
      .input("attachment_id", sql.UniqueIdentifier, data.attachment_id);
    if (data.id) {
      const { rowsAffected } = await req.input("id", sql.UniqueIdentifier, data.id).query(
        `UPDATE dbo.booking_instructions
            SET site_id = @site_id, contact_person = @contact_person, email = @email, mobile = @mobile,
                sic_session = @sic_session, remarks = @remarks, note = @note, attachment_id = @attachment_id
          WHERE id = @id`,
      );
      if (!rowsAffected[0]) throw new Error("This booking instruction no longer exists.");
    } else {
      await req.query(
        `INSERT INTO dbo.booking_instructions
           (site_id, contact_person, email, mobile, sic_session, remarks, note, attachment_id)
         VALUES (@site_id, @contact_person, @email, @mobile, @sic_session, @remarks, @note, @attachment_id)`,
      );
    }
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.id)
      .query(`DELETE FROM dbo.booking_instructions WHERE id = @id`);
    return { ok: true };
  });
