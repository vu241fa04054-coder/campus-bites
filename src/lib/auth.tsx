import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { credentialsFor, normalizeName, type AccountKind } from "./rules";

export type Role = "student" | "admin";

type AuthState = {
  loading: boolean;
  user: User | null;
  role: Role | null;
  name: string | null;
};

const AuthContext = createContext<AuthState>({ loading: true, user: null, role: null, name: null });

export async function fetchRole(userId: string): Promise<Role | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (data?.some((r) => r.role === "admin")) return "admin";
  if (data?.some((r) => r.role === "student")) return "student";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ loading: true, user: null, role: null, name: null });

  useEffect(() => {
    let active = true;
    const load = async (user: User | null) => {
      if (!user) {
        if (active) setState({ loading: false, user: null, role: null, name: null });
        return;
      }
      const role = await fetchRole(user.id);
      const name = (user.user_metadata?.["name"] as string | undefined) ?? null;
      if (active) setState({ loading: false, user, role, name });
    };

    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Defer to avoid running queries inside the auth callback.
      setTimeout(() => {
        load(session?.user ?? null);
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

function friendlyAuthError(message: string, kind: AccountKind): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Name or PIN is incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return kind === "student"
      ? "A student with this name is already registered. Log in, or add your surname/initial."
      : "This admin name is already taken.";
  if (m.includes("database error")) return "Could not create the account. Please try a different name.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

export async function signInWithPin(kind: AccountKind, name: string, pin: string) {
  const creds = credentialsFor(kind, name, pin);
  const { data, error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw new Error(friendlyAuthError(error.message, kind));
  const role = await fetchRole(data.user.id);
  if (role !== kind) {
    await supabase.auth.signOut();
    throw new Error(kind === "admin" ? "This account is not an admin." : "Please use the admin login page.");
  }
  return data.user;
}

export async function registerWithPin(kind: AccountKind, name: string, pin: string) {
  const creds = credentialsFor(kind, name, pin);
  const { data, error } = await supabase.auth.signUp({
    ...creds,
    options: { data: { name: normalizeName(name) } },
  });
  if (error) {
    if (kind === "admin" && error.message.toLowerCase().includes("database error")) {
      throw new Error("Admin setup is closed — an admin account already exists.");
    }
    throw new Error(friendlyAuthError(error.message, kind));
  }
  if (!data.session) {
    // Account exists but no session: sign in directly.
    return signInWithPin(kind, name, pin);
  }
  return data.user;
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async (to: "/" | "/login" | "/admin-login" = "/") => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to, replace: true });
  };
}
