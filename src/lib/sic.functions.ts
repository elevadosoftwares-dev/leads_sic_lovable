import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";

export type Site = { id: string; name: string; image_url: string | null; created_at: string };
export type Department = { id: string; name: string; created_at: string };
export type Employee = {
  id: string;
  name: string;
  designation: string | null;
  image_url: string | null;
  status: string;
  department_id: string | null;
  created_at: string;
  department: { id: string; name: string } | null;
};
export type SicRecord = {
  id: string;
  site_id: string;
  employee_id: string;
  sic_date: string;
  pass_issued: boolean;
  expiry_date: string | null;
  attachment_url: string | null;
  created_at: string;
  site: { id: string; name: string };
  employee: { id: string; name: string; image_url: string | null; status: string };
};
export type Booking = {
  id: string;
  site_id: string;
  contact_person: string;
  email: string;
  mobile: string;
  sic_session: string | null;
  remarks: string | null;
  note: string | null;
  attachment_url: string | null;
  created_at: string;
  site: { id: string; name: string };
};
export type UserRole = { id: string; user_id: string; email: string; role: "admin" | "viewer" };

/** Embeds `table` row `fk` as a nested object, e.g. `site: { id, name }` on each row. */
const embed = (table: string, cols: string, fk: string, as: string) =>
  `JSON_QUERY((SELECT ${cols} FROM dbo.${table} x WHERE x.id = ${fk} FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS ${as}`;

// ------------------------------------------------------------------ reads (any signed-in user)

export const listSites = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<Site>(`SELECT id, name, image_url, created_at FROM dbo.sites ORDER BY name`);
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<Employee>(
      `SELECT e.id, e.name, e.designation, e.image_url, e.status, e.department_id, e.created_at,
              ${embed("departments", "x.id, x.name", "e.department_id", "department")}
         FROM dbo.employees e ORDER BY e.name`,
    );
  });

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<Department>(`SELECT id, name, created_at FROM dbo.departments ORDER BY name`);
  });

export const listSicRecords = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<SicRecord>(
      `SELECT r.id, r.site_id, r.employee_id, r.sic_date, r.pass_issued, r.expiry_date,
              r.attachment_url, r.created_at,
              ${embed("sites", "x.id, x.name", "r.site_id", "site")},
              ${embed("employees", "x.id, x.name, x.image_url, x.status", "r.employee_id", "employee")}
         FROM dbo.sic_records r ORDER BY r.sic_date DESC`,
    );
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<Booking>(
      `SELECT b.id, b.site_id, b.contact_person, b.email, b.mobile, b.sic_session, b.remarks,
              b.note, b.attachment_url, b.created_at,
              ${embed("sites", "x.id, x.name", "b.site_id", "site")}
         FROM dbo.booking_instructions b ORDER BY b.created_at DESC`,
    );
  });

export const listUserRoles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<UserRole>(
      `SELECT id, id AS user_id, email, role FROM dbo.users ORDER BY email`,
    );
  });

// ------------------------------------------------------------------ writes (admins only)

const id = z.string().uuid();
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null));
const filePath = z
  .string()
  .max(400)
  .nullish()
  .transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

const deleteSchema = z.object({ id });

const siteSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Enter a site name.").max(300),
  image_url: filePath,
});

export const saveSite = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => siteSchema.parse(d))
  .handler(async ({ data: { id, ...row } }) => {
    const { insertRow, updateRow } = await import("@/server/rows.server");
    if (id) await updateRow("sites", id, row);
    else await insertRow("sites", row);
    return { ok: true };
  });

export const deleteSite = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    // SIC records and booking instructions for the site go with it (ON DELETE CASCADE).
    await deleteRow("sites", data.id);
    return { ok: true };
  });

const employeeSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Enter a name.").max(200),
  designation: optionalText,
  status: z.enum(["active", "inactive"]),
  image_url: filePath,
  department_id: id
    .nullish()
    .or(z.literal(""))
    .transform((v) => v || null),
});

export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => employeeSchema.parse(d))
  .handler(async ({ data: { id, ...row } }) => {
    const { insertRow, updateRow } = await import("@/server/rows.server");
    if (id) await updateRow("employees", id, row);
    else await insertRow("employees", row);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    await deleteRow("employees", data.id);
    return { ok: true };
  });

export const addDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().trim().min(1, "Enter a name.").max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { insertRow } = await import("@/server/rows.server");
    const { isDuplicateKeyError } = await import("@/server/db.server");
    try {
      await insertRow("departments", { name: data.name });
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error(`"${data.name}" already exists.`);
      throw error;
    }
    return { ok: true };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    await deleteRow("departments", data.id);
    return { ok: true };
  });

const sicSchema = z.object({
  id: id.optional(),
  site_id: id,
  /** One technician when editing; one or more when registering. */
  employee_ids: z.array(id).min(1, "Select at least one technician."),
  sic_date: date,
  pass_issued: z.boolean(),
  expiry_date: date
    .nullish()
    .or(z.literal(""))
    .transform((v) => v || null),
  attachment_url: filePath,
});

export const saveSicRecords = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => sicSchema.parse(d))
  .handler(async ({ data: { id, employee_ids, ...base } }) => {
    const { insertRow, updateRow } = await import("@/server/rows.server");
    if (id) {
      await updateRow("sic_records", id, { ...base, employee_id: employee_ids[0] });
    } else {
      for (const employee_id of employee_ids)
        await insertRow("sic_records", { ...base, employee_id });
    }
    return { ok: true };
  });

export const deleteSicRecord = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    await deleteRow("sic_records", data.id);
    return { ok: true };
  });

const bookingSchema = z.object({
  id: id.optional(),
  site_id: id,
  contact_person: z.string().trim().min(1, "Enter a contact person.").max(200),
  email: z.string().trim().min(1, "Enter an email.").max(320),
  mobile: z.string().trim().min(1, "Enter a mobile number.").max(50),
  sic_session: optionalText,
  remarks: optionalText,
  note: optionalText,
  attachment_url: filePath,
});

export const saveBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data: { id, ...row } }) => {
    const { insertRow, updateRow } = await import("@/server/rows.server");
    if (id) await updateRow("booking_instructions", id, row);
    else await insertRow("booking_instructions", row);
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    await deleteRow("booking_instructions", data.id);
    return { ok: true };
  });

/** Stores an uploaded picture/attachment and returns the path to save on the row. */
export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data.");
    const file = d.get("file");
    const folder = d.get("folder");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
    return { file, folder: typeof folder === "string" ? folder : "files" };
  })
  .handler(async ({ data }) => {
    const { saveFile } = await import("@/server/files.server");
    return { path: await saveFile(data.file, data.folder) };
  });
