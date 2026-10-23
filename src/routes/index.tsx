import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LEADS SIC — Safety Induction Tracker" },
      { name: "description", content: "Register technicians and track safety induction courses by client site." },
      { property: "og:title", content: "LEADS SIC — Safety Induction Tracker" },
      { property: "og:description", content: "Register technicians and track safety induction courses by client site." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
