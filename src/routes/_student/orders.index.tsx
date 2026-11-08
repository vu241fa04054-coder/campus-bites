import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageTitle, PaymentBadge, StatusBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatINR, formatPickup } from "@/lib/format";

export const Route = createFileRoute("/_student/orders/")({
  head: () => ({
    meta: [
      { title: "My orders — CampusBite" },
      { name: "description", content: "Your CampusBite order history and current order status." },
      { property: "og:title", content: "My orders — CampusBite" },
      { property: "og:description", content: "Your order history and status." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_code, total_amount, status, payment_status, pickup_date, pickup_time, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageTitle title="My orders" subtitle="Track current orders and see your history." />
      {orders.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !orders.data?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">You haven't placed any orders yet.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/menu">Browse menu</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link
                to="/orders/$orderId"
                params={{ orderId: o.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-soft hover:shadow-lift"
              >
                <div>
                  <p className="font-semibold">{o.order_code}</p>
                  <p className="text-xs text-muted-foreground">
                    Placed {formatDateTime(o.created_at)} · Pickup {formatPickup(o.pickup_date, o.pickup_time)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} />
                  <PaymentBadge status={o.payment_status} />
                  <span className="font-semibold text-primary">{formatINR(o.total_amount)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
