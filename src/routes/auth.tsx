import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { signIn, signUp } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/sic-ui";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — LEADS SIC" },
      { name: "description", content: "Sign in to manage technician safety inductions." },
      { property: "og:title", content: "Sign in — LEADS SIC" },
      { property: "og:description", content: "Sign in to manage technician safety inductions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        await signUp({ data: { email, password } });
        toast.success("Account created.");
      }
      await signIn({ data: { email, password } });
      qc.clear();
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-auth p-12 text-nav-foreground md:flex">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-coral/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-teal/30 blur-3xl" />
        <div className="pointer-events-none absolute right-24 top-1/3 h-40 w-40 rounded-full bg-sun/25 blur-2xl" />
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          LEADS SIC
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            The right technician,
            <br />
            <span className="text-sun">cleared for the right site.</span>
          </h1>
          <p className="mt-4 max-w-md text-nav-muted">
            Track every safety induction course across your client sites, catch expiries before they
            happen, and plan daily jobs with confidence.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="h-2 w-10 rounded-full bg-coral" />
          <span className="h-2 w-10 rounded-full bg-teal" />
          <span className="h-2 w-10 rounded-full bg-sun" />
          <span className="h-2 w-10 rounded-full bg-sky" />
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold">
              {mode === "in" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "in" ? "Sign in to your SIC workspace" : "Register a new staff account"}
            </p>
          </div>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
