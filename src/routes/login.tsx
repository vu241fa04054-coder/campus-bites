import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AuthCard, safeRedirect } from "@/components/auth-card";
import { PinInput } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPin, useAuth } from "@/lib/auth";
import { validateName, validatePin } from "@/lib/rules";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s["redirect"] === "string" ? (s["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Student login — CampusBite" },
      { name: "description", content: "Log in to CampusBite with your name and PIN to order canteen food." },
      { property: "og:title", content: "Student login — CampusBite" },
      { property: "og:description", content: "Log in with your name and PIN to order canteen food." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && role === "student") router.history.push(safeRedirect(redirect, "/menu"));
    if (user && role === "admin") router.navigate({ to: "/admin" });
  }, [user, role, redirect, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = validateName(name);
    if (!n.ok) return setError(n.error);
    const p = validatePin(pin);
    if (!p.ok) return setError(p.error);
    setBusy(true);
    try {
      await signInWithPin("student", name, pin);
      router.history.push(safeRedirect(redirect, "/menu"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Student login"
      subtitle="Welcome back! Enter your name and PIN."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create a student account
          </Link>
          <div className="mt-2">
            Canteen staff?{" "}
            <Link to="/admin-login" className="font-semibold text-accent hover:underline">
              Admin login
            </Link>
          </div>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Student name</Label>
          <Input id="name" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" maxLength={50} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN</Label>
          <PinInput id="pin" value={pin} onChange={setPin} />
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Log in
        </Button>
      </form>
    </AuthCard>
  );
}
