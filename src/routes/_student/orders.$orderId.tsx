import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { BackButton, PageTitle, PaymentBadge, StatusBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, formatDateTime, formatINR, formatPickup } from "@/lib/format";
import { canStudentCancel, isTrackingActive } from "@/lib/rules";

export const Route = createFileRoute("/_student/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order details — CampusBite" },
      { name: "description", content: "Status, items and pickup details for your CampusBite order." },
      { property: "og:title", content: "Order details — CampusBite" },
      { property: "og:description", content: "Status and pickup details for your order." },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, item_name, quantity, unit_price, line_total), order_locations(id, location_label, latitude, longitude, source, created_at)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    const channel = supabase
      .channel(`order-${orderId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_locations", filter: `order_id=eq.${orderId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, queryClient]);

  const cancel = async () => {
    if (!window.confirm("Cancel this order?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Order cancelled");
    queryClient.invalidateQueries();
  };

  if (order.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!order.data) return <p>Order not found.</p>;
  const o = order.data;
  const latest = [...(o.order_locations ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton fallback="/orders" label="Back to orders" />
      <PageTitle title={`Order ${o.order_code}`} subtitle={`Placed ${formatDateTime(o.created_at)}`}>
        <div className="flex gap-2">
          <StatusBadge status={o.status} />
          <PaymentBadge status={o.payment_status} />
        </div>
      </PageTitle>

      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Pickup</p>
          <p className="font-semibold">{formatPickup(o.pickup_date, o.pickup_time)}</p>
          <ul className="mt-4 divide-y">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <span>
                  {i.item_name} × {i.quantity}
                </span>
                <span>{formatINR(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t pt-3 font-bold">
            <span>Total</span>
            <span className="text-primary">{formatINR(o.total_amount)}</span>
          </div>
        </div>

        {latest && (
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-accent" /> Latest location
            </p>
            {latest.location_label && <p className="mt-1">{latest.location_label}</p>}
            {latest.latitude != null && latest.longitude != null && (
              <a
                className="text-sm text-primary underline"
                href={`https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                View on map
              </a>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {formatDateTime(latest.created_at)} ({latest.source === "gps" ? "device GPS" : "manual"})
              {!isTrackingActive(o.status) && " · tracking stopped"}
            </p>
          </div>
        )}

        {o.payment_status !== "paid" && isTrackingActive(o.status) && (
          <div className="rounded-2xl border bg-accent-soft p-5 text-sm">
            Online payment isn't set up yet — please pay at the counter when you pick up. Staff will mark your order as paid.
          </div>
        )}

        {canStudentCancel(o.status) && (
          <Button variant="destructive" onClick={cancel} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Cancel order
          </Button>
        )}
      </div>
    </div>
  );
}
