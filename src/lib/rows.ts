import { z } from "zod";

// SQL Server returns UNIQUEIDENTIFIER values in upper case; the app compares ids in lower case.
export const lowerId = (id: string) => id.toLowerCase();
export const lowerIdOrNull = (id: string | null) => (id ? id.toLowerCase() : null);

// DATE columns arrive as UTC midnight, so the ISO date part is the stored calendar date.
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const isoDateOrNull = (d: Date | null) => (d ? isoDate(d) : null);
export const toSqlDate = (day: string) => new Date(`${day}T00:00:00Z`);

export const idSchema = z.string().uuid();
/** An optional reference to an uploaded file, or to another row. */
export const optionalIdSchema = z.string().uuid().nullable();
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
/** Trimmed text that is stored as NULL when left empty. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
