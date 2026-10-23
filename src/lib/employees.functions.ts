import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import { idSchema, lowerId, lowerIdOrNull, optionalIdSchema, optionalText } from "@/lib/rows";

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  designation: string | null;
  image_id: string | null;
  status: string;
  department_id: string | null;
  department: Department | null;
}

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Employee[]> => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<
      Omit<Employee, "department"> & { department_name: string | null }
    >(
      `SELECT e.id, e.name, e.designation, e.image_id, e.status, e.department_id,
              d.name AS department_name
         FROM dbo.employees e LEFT JOIN dbo.departments d ON d.id = e.department_id
        ORDER BY e.name`,
    );
    return recordset.map(({ department_name, ...e }) => {
      const department_id = lowerIdOrNull(e.department_id);
      return {
        ...e,
        id: lowerId(e.id),
        image_id: lowerIdOrNull(e.image_id),
        department_id,
        department:
          department_id && department_name ? { id: department_id, name: department_name } : null,
      };
    });
  });

const saveEmployeeSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Name is required").max(300),
  designation: optionalText(200),
  status: z.enum(["active", "inactive"]),
  image_id: optionalIdSchema,
  department_id: optionalIdSchema,
});

export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: z.input<typeof saveEmployeeSchema>) => saveEmployeeSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    req
      .input("name", sql.NVarChar(300), data.name)
      .input("designation", sql.NVarChar(200), data.designation)
      .input("status", sql.NVarChar(20), data.status)
      .input("image_id", sql.UniqueIdentifier, data.image_id)
      .input("department_id", sql.UniqueIdentifier, data.department_id);
    if (data.id) {
      const { rowsAffected } = await req.input("id", sql.UniqueIdentifier, data.id).query(
        `UPDATE dbo.employees
            SET name = @name, designation = @designation, status = @status,
                image_id = @image_id, department_id = @department_id
          WHERE id = @id`,
      );
      if (!rowsAffected[0]) throw new Error("This technician no longer exists.");
    } else {
      await req.query(
        `INSERT INTO dbo.employees (name, designation, status, image_id, department_id)
         VALUES (@name, @designation, @status, @image_id, @department_id)`,
      );
    }
    return { ok: true };
  });

/** Deletes a technician together with their SIC records (ON DELETE CASCADE). */
export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.id)
      .query(`DELETE FROM dbo.employees WHERE id = @id`);
    return { ok: true };
  });

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Department[]> => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<Department>(
      `SELECT id, name FROM dbo.departments ORDER BY name`,
    );
    return recordset.map((d) => ({ ...d, id: lowerId(d.id) }));
  });

export const addDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const req = await request();
    try {
      await req
        .input("name", sql.NVarChar(200), data.name)
        .query(`INSERT INTO dbo.departments (name) VALUES (@name)`);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error("This department already exists.");
      throw error;
    }
    return { ok: true };
  });

/** Technicians in the department keep no department (ON DELETE SET NULL). */
export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.id)
      .query(`DELETE FROM dbo.departments WHERE id = @id`);
    return { ok: true };
  });
