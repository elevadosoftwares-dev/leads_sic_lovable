import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession, type SessionInfo } from "@/lib/auth.functions";
import { listBookings } from "@/lib/bookings.functions";
import { listDepartments, listEmployees } from "@/lib/employees.functions";
import { uploadFile as uploadFileFn } from "@/lib/files.functions";
import { listSicRecords, type SicRecord } from "@/lib/sic.functions";
import { listSites } from "@/lib/sites.functions";
import { listUsers } from "@/lib/users.functions";

export const sessionQueryKey = ["session"] as const;

export const sessionQuery = queryOptions<SessionInfo>({
  queryKey: sessionQueryKey,
  queryFn: () => getSession(),
  staleTime: 60_000,
});

export const sitesQuery = queryOptions({ queryKey: ["sites"], queryFn: () => listSites() });

export const employeesQuery = queryOptions({
  queryKey: ["employees"],
  queryFn: () => listEmployees(),
});

export const departmentsQuery = queryOptions({
  queryKey: ["departments"],
  queryFn: () => listDepartments(),
});

export const sicQuery = queryOptions({ queryKey: ["sic"], queryFn: () => listSicRecords() });

export const bookingsQuery = queryOptions({
  queryKey: ["bookings"],
  queryFn: () => listBookings(),
});

export type SicRow = SicRecord;

export const usersQuery = queryOptions({ queryKey: ["users"], queryFn: () => listUsers() });

export function useSession() {
  return useQuery(sessionQuery).data;
}

export function useIsAdmin() {
  return useSession()?.role === "admin";
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/** Uploads a file and returns its id, to be saved on the row it belongs to. */
export async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { id } = await uploadFileFn({ data: form });
  return id;
}
