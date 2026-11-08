import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth-card";
import { PinInput } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { registerWithPin, signInWithPin, useAuth } from "@/lib/auth";
import { validateName, validatePin } from "@/lib/rules";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin login — CampusBite" },
      { name: "description", content: "Canteen staff login for the CampusBite admin dashboard." },
      { property: "og:title", content: "Admin login — CampusBite" },
      { property: "og:description", content: "Canteen staff login for the CampusBite admin dashboard." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const adminExists = useQuery({
    queryKey: ["admin-exists"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (error) throw error;
      return data;
    },
  });
  const setupMode = adminExists.data === false;

  useEffect(() => {
    if (user && role === "admin") router.navigate({ to: "/admin" });
  }, [user, role, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = validateName(name);
    if (!n.ok) return setError(n.error);
    const p = validatePin(pin);
    if (!p.ok) return setError(p.error);
    if (setupMode && pin !== confirm) return setError("PINs do not match.");
    setBusy(true);
    try {
      if (setupMode) {
        await registerWithPin("admin", name, pin);
        toast.success("Admin account created. Setup is now closed.");
      } else {
        await signInWithPin("admin", name, pin);
      }
      router.navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      queryClient.invalidateQueries({ queryKey: ["admin-exists"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      badge={
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
          <ShieldCheck className="h-3.5 w-3.5" /> Canteen staff only
        </span>
      }
      title={setupMode ? "First-time admin setup" : "Admin login"}
      subtitle={
        setupMode
          ? "No admin exists yet. Create the first admin account — this form closes permanently afterwards."
          : "Enter your admin name and PIN."
      }
      footer={
        <>
          Are you a student?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Student login
          </Link>
        </>
      }
    >
      {adminExists.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="admin-name">Admin name</Label>
            <Input id="admin-name" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="e.g. Canteen Manager" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-pin">PIN</Label>
            <PinInput id="admin-pin" value={pin} onChange={setPin} autoComplete={setupMode ? "new-password" : "current-password"} />
          </div>
          {setupMode && (
            <div className="space-y-1.5">
              <Label htmlFor="admin-confirm">Confirm PIN</Label>
              <PinInput id="admin-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </div>
          )}
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" variant={setupMode ? "accent" : "default"} className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {setupMode ? "Create admin account" : "Log in as admin"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
