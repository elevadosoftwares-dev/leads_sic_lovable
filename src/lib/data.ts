import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth.functions";
import {
  listBookings,
  listDepartments,
  listEmployees,
  listSicRecords,
  listSites,
  listUserRoles,
  uploadFile as uploadFileFn,
  type SicRecord,
} from "@/lib/sic.functions";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getSession(),
});

export const sitesQuery = queryOptions({
  queryKey: ["sites"],
  queryFn: () => listSites(),
});

export const employeesQuery = queryOptions({
  queryKey: ["employees"],
  queryFn: () => listEmployees(),
});

export const departmentsQuery = queryOptions({
  queryKey: ["departments"],
  queryFn: () => listDepartments(),
});

export const sicQuery = queryOptions({
  queryKey: ["sic"],
  queryFn: () => listSicRecords(),
});

export const bookingsQuery = queryOptions({
  queryKey: ["bookings"],
  queryFn: () => listBookings(),
});

export type SicRow = SicRecord;

export const userRolesQuery = queryOptions({
  queryKey: ["user_roles"],
  queryFn: () => listUserRoles(),
});

export function useIsAdmin() {
  return useQuery(sessionQuery).data?.role === "admin";
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/** Uploads a picture/attachment and returns its path, which the row stores. */
export async function uploadFile(file: File, folder: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  const { path } = await uploadFileFn({ data: form });
  return path;
}
