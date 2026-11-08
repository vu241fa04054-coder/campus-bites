import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSignOut } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_student/profile")({
  head: () => ({
    meta: [
      { title: "My profile — CampusBite" },
      { name: "description", content: "Your CampusBite student profile." },
      { property: "og:title", content: "My profile — CampusBite" },
      { property: "og:description", content: "Your CampusBite student profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const signOut = useSignOut();
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("name, created_at").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="My profile" />
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <p className="text-sm text-muted-foreground">Name</p>
        <p className="text-lg font-semibold">{profile.data?.name ?? "…"}</p>
        {profile.data && (
          <p className="mt-2 text-sm text-muted-foreground">Member since {formatDateTime(profile.data.created_at)}</p>
        )}
        <Button variant="outline" className="mt-5" onClick={() => signOut("/")}>
          Log out
        </Button>
      </div>
    </div>
  );
}
