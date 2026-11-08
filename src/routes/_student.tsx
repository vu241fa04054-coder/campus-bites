import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { fetchRole } from "@/lib/auth";

// Session lives in browser storage, so this gate runs client-side only.
export const Route = createFileRoute("/_student")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
    const role = await fetchRole(data.user.id);
    if (role === "admin") throw redirect({ to: "/admin" });
    if (role !== "student") throw redirect({ to: "/login", search: { redirect: location.href } });
    return { userId: data.user.id };
  },
  component: StudentLayout,
});

function StudentLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
