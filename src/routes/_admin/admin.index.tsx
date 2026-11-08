import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageTitle, PaymentBadge, StatusBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, formatDateTime, formatINR, formatPickup, STATUS_LABEL } from "@/lib/format";
import { CLOSED_STATUSES, ORDER_STATUSES, type OrderStatus } from "@/lib/rules";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — CampusBite" },
      { name: "description", content: "Live order statistics and order management for CampusBite." },
      { property: "og:title", content: "Admin dashboard — CampusBite" },
      { property: "og:description", content: "Live order statistics and order management." },
    ],
  }),
  component: AdminDashboard,
});

const STATS: [string, string][] = [
  ["total", "Total Orders"],
  ["new_today", "New Today"],
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["preparing", "Preparing"],
  ["ready", "Ready"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["paid", "Paid"],
  ["unpaid", "Unpaid"],
];

function AdminDashboard() {
  const queryClient = useQueryClient();

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, item_name, quantity)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Realtime: new orders and cancellations notify the admin immediately.
  useEffect(() => {
    const channel = supabase
      .channel(`admin-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const n = payload.new as { title: string; payload: { student_name?: string; total?: number; pickup_time?: string } };
        toast.info(n.title, {
          description: `${n.payload.student_name ?? ""} · ${formatINR(n.payload.total)} · pickup ${n.payload.pickup_time ?? ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const setStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.rpc("admin_update_order_status", { p_order_id: id, p_status: status });
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.rpc("admin_set_payment_status", { p_order_id: id, p_status: "paid" });
    if (error) return toast.error(errorMessage(error));
    toast.success("Marked as paid at counter");
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div>
      <PageTitle title="Admin dashboard" subtitle="Live statistics from the database." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map(([key, label]) => (
          <div key={key} className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold">{stats.data?.[key] ?? "–"}</p>
          </div>
        ))}
        <div className="rounded-2xl border bg-primary-soft p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="font-display text-2xl font-bold text-primary">{formatINR(stats.data?.["revenue"])}</p>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-xl font-bold">Manage orders</h2>
      {orders.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !orders.data?.length ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => {
            const closed = CLOSED_STATUSES.includes(o.status);
            return (
              <li key={o.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {o.order_code} · {o.student_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Placed {formatDateTime(o.created_at)} · Pickup {formatPickup(o.pickup_date, o.pickup_time)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    <PaymentBadge status={o.payment_status} />
                    <span className="font-semibold text-primary">{formatINR(o.total_amount)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm">{o.order_items.map((i) => `${i.item_name} × ${i.quantity}`).join(", ")}</p>
                {!closed && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Order status"
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={o.status}
                      onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    {o.payment_status !== "paid" && (
                      <Button size="sm" variant="soft" onClick={() => markPaid(o.id)}>
                        Mark paid (counter)
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
