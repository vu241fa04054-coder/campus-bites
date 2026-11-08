import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BackButton, PageTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartIssues } from "@/hooks/use-cart-issues";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { errorMessage, formatINR, formatPickup } from "@/lib/format";
import {
  addDays,
  canPickupToday,
  CANTEEN_CLOSE,
  CANTEEN_OPEN,
  istNow,
  PICKUP_BUFFER_MINUTES,
  validatePickup,
} from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — CampusBite" },
      { name: "description", content: "Confirm your order and choose a pickup time." },
      { property: "og:title", content: "Checkout — CampusBite" },
      { property: "og:description", content: "Confirm your order and choose a pickup time." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { issues, total, live, loading } = useCartIssues();
  const [today, setToday] = useState(() => istNow().date);
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setToday(istNow().date);
    if (!canPickupToday()) setDay("tomorrow");
  }, []);

  const date = day === "today" ? today : addDays(today, 1);
  const check = validatePickup(date, time);
  const todayOpen = canPickupToday();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    const latest = validatePickup(date, time);
    if (!latest.ok) return;
    if (issues.size > 0) return setServerError("Some items in your cart are no longer available. Please review your cart.");
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_items: cart.lines.map((l) => ({ food_item_id: l.foodId, quantity: l.quantity })),
      p_pickup_date: date,
      p_pickup_time: time.trim(),
    });
    setBusy(false);
    if (error || !data) {
      setServerError(errorMessage(error));
      queryClient.invalidateQueries({ queryKey: ["food-items"] });
      return;
    }
    cart.clear();
    queryClient.invalidateQueries({ queryKey: ["food-items"] });
    queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    toast.success("Order placed!");
    router.navigate({ to: "/orders/$orderId", params: { orderId: data } });
  };

  if (cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/menu">Browse menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <BackButton fallback="/menu" label="Back to cart" />
      <PageTitle title="Checkout" subtitle="Review your order and tell us when you'll pick it up." />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
        <section className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-accent" /> Pickup time
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Canteen hours {CANTEEN_OPEN}–{CANTEEN_CLOSE} IST. Same-day orders need at least {PICKUP_BUFFER_MINUTES} minutes.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pickup day">
              {(["today", "tomorrow"] as const).map((d) => {
                const disabled = d === "today" && !todayOpen;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={day === d}
                    disabled={disabled}
                    onClick={() => setDay(d)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      day === d ? "border-primary bg-primary-soft" : "hover:border-primary/40",
                    )}
                  >
                    <span className="block font-semibold capitalize">{d}</span>
                    <span className="text-xs text-muted-foreground">
                      {disabled ? "Closed for today" : formatPickup(d === "today" ? today : addDays(today, 1), "").replace(/, *IST$/, "").replace(/, $/, "")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="pickup-time">Pickup time (24-hour, HH:mm)</Label>
              <Input
                id="pickup-time"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 13:30"
                maxLength={5}
                value={time}
                onChange={(e) => setTime(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !check.ok}
                className="h-12 max-w-[180px] text-lg tracking-wider"
              />
              {touched && !check.ok ? (
                <p className="text-sm text-destructive">{check.error}</p>
              ) : check.ok ? (
                <p className="text-sm text-primary">Pickup: {formatPickup(date, time.trim())}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <ul className="mt-3 divide-y">
              {cart.lines.map((l) => {
                const price = live.get(l.foodId)?.price ?? l.price;
                return (
                  <li key={l.foodId} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{l.name}</span>
                      <span className="text-muted-foreground"> × {l.quantity}</span>
                      {issues.get(l.foodId) && <span className="ml-2 text-xs text-destructive">({issues.get(l.foodId)})</span>}
                    </span>
                    <span className="font-medium">{formatINR(price * l.quantity)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-soft lg:sticky lg:top-24">
          <div className="flex justify-between text-lg font-bold">
            <span>Total amount</span>
            <span className="text-primary">{formatINR(total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">You can pay online after placing the order, or pay at the counter.</p>
          {serverError && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy || loading}>
            {busy && <Loader2 className="animate-spin" />} Place order
          </Button>
        </aside>
      </form>
    </div>
  );
}
