import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import {
  daySchema,
  idSchema,
  isoDate,
  isoDateOrNull,
  lowerId,
  lowerIdOrNull,
  optionalIdSchema,
  toSqlDate,
} from "@/lib/rows";

export interface SicRecord {
  id: string;
  site_id: string;
  employee_id: string;
  sic_date: string;
  pass_issued: boolean;
  expiry_date: string | null;
  attachment_id: string | null;
  site: { id: string; name: string };
  employee: { id: string; name: string; image_id: string | null; status: string };
}

type SicRow = {
  id: string;
  site_id: string;
  employee_id: string;
  sic_date: Date;
  pass_issued: boolean;
  expiry_date: Date | null;
  attachment_id: string | null;
  site_name: string;
  employee_name: string;
  employee_image_id: string | null;
  employee_status: string;
};

export const listSicRecords = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<SicRecord[]> => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<SicRow>(
      `SELECT r.id, r.site_id, r.employee_id, r.sic_date, r.pass_issued, r.expiry_date, r.attachment_id,
              s.name AS site_name, e.name AS employee_name, e.image_id AS employee_image_id,
              e.status AS employee_status
         FROM dbo.sic_records r
         JOIN dbo.sites s ON s.id = r.site_id
         JOIN dbo.employees e ON e.id = r.employee_id
        ORDER BY r.sic_date DESC, r.created_at DESC`,
    );
    return recordset.map((r) => {
      const site_id = lowerId(r.site_id);
      const employee_id = lowerId(r.employee_id);
      return {
        id: lowerId(r.id),
        site_id,
        employee_id,
        sic_date: isoDate(r.sic_date),
        pass_issued: r.pass_issued,
        expiry_date: isoDateOrNull(r.expiry_date),
        attachment_id: lowerIdOrNull(r.attachment_id),
        site: { id: site_id, name: r.site_name },
        employee: {
          id: employee_id,
          name: r.employee_name,
          image_id: lowerIdOrNull(r.employee_image_id),
          status: r.employee_status,
        },
      };
    });
  });

const MAX_EMPLOYEES_PER_SAVE = 500;

const saveSicSchema = z
  .object({
    /** Set when editing one record; then exactly one employee is given. */
    id: idSchema.optional(),
    site_id: idSchema,
    employee_ids: z
      .array(idSchema)
      .min(1, "Choose at least one technician")
      .max(MAX_EMPLOYEES_PER_SAVE),
    sic_date: daySchema,
    pass_issued: z.boolean(),
    expiry_date: daySchema.nullable(),
    attachment_id: optionalIdSchema,
  })
  .refine((v) => !v.id || v.employee_ids.length === 1, "Choose one technician");

/** Registers one SIC record per selected technician, or updates a single record. */
export const saveSicRecords = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: z.input<typeof saveSicSchema>) => saveSicSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    req
      .input("site_id", sql.UniqueIdentifier, data.site_id)
      .input("sic_date", sql.Date, toSqlDate(data.sic_date))
      .input("pass_issued", sql.Bit, data.pass_issued)
      .input("expiry_date", sql.Date, data.expiry_date ? toSqlDate(data.expiry_date) : null)
      .input("attachment_id", sql.UniqueIdentifier, data.attachment_id);

    if (data.id) {
      const { rowsAffected } = await req
        .input("id", sql.UniqueIdentifier, data.id)
        .input("employee_id", sql.UniqueIdentifier, data.employee_ids[0])
        .query(
          `UPDATE dbo.sic_records
              SET site_id = @site_id, employee_id = @employee_id, sic_date = @sic_date,
                  pass_issued = @pass_issued, expiry_date = @expiry_date, attachment_id = @attachment_id
            WHERE id = @id`,
        );
      if (!rowsAffected[0]) throw new Error("This SIC record no longer exists.");
      return { count: 1 };
    }

    // One INSERT statement, so either every selected technician is registered or none is.
    const values = data.employee_ids.map((employeeId, i) => {
      req.input(`e${i}`, sql.UniqueIdentifier, employeeId);
      return `(@site_id, @e${i}, @sic_date, @pass_issued, @expiry_date, @attachment_id)`;
    });
    await req.query(
      `INSERT INTO dbo.sic_records (site_id, employee_id, sic_date, pass_issued, expiry_date, attachment_id)
       VALUES ${values.join(",\n")}`,
    );
    return { count: values.length };
  });

export const deleteSicRecord = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.id)
      .query(`DELETE FROM dbo.sic_records WHERE id = @id`);
    return { ok: true };
  });
