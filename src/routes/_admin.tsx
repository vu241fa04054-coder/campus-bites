import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole } from "@/lib/auth";

// UI gate only; the database enforces admin permissions on every action.
export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/admin-login" });
    const role = await fetchRole(data.user.id);
    if (role !== "admin") throw redirect({ to: "/admin-login" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
