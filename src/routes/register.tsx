import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { PinInput } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerWithPin, useAuth } from "@/lib/auth";
import { validateName, validatePin } from "@/lib/rules";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Student registration — CampusBite" },
      { name: "description", content: "Create your CampusBite student account with your name and a numeric PIN." },
      { property: "og:title", content: "Student registration — CampusBite" },
      { property: "og:description", content: "Create your CampusBite student account in seconds." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && role === "student") router.navigate({ to: "/menu" });
  }, [user, role, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = validateName(name);
    if (!n.ok) return setError(n.error);
    const p = validatePin(pin);
    if (!p.ok) return setError(p.error);
    if (pin !== confirm) return setError("PINs do not match.");
    setBusy(true);
    try {
      await registerWithPin("student", name, pin);
      toast.success("Welcome to CampusBite!");
      router.navigate({ to: "/menu" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create student account"
      subtitle="Use your name and a numeric PIN (1–10 digits) to log in."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Student name</Label>
          <Input id="name" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" maxLength={50} />
          <p className="text-xs text-muted-foreground">You'll log in with this exact name.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN</Label>
          <PinInput id="pin" value={pin} onChange={setPin} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm PIN</Label>
          <PinInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
    </AuthCard>
  );
}
