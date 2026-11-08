import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { BackButton, FoodImage, PageTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useCartIssues } from "@/hooks/use-cart-issues";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_student/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — CampusBite" },
      { name: "description", content: "Review the items in your CampusBite cart before checkout." },
      { property: "og:title", content: "Your cart — CampusBite" },
      { property: "og:description", content: "Review your cart before checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const { issues, total, live } = useCartIssues();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-muted-foreground">Add something tasty from the menu.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/menu">Browse menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <BackButton fallback="/menu" label="Back to menu" />
      <PageTitle title="Your cart" subtitle={`${cart.count} item${cart.count > 1 ? "s" : ""}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-3">
          {cart.lines.map((l) => {
            const f = live.get(l.foodId);
            const price = f?.price ?? l.price;
            const max = f?.stock ?? l.stock;
            const issue = issues.get(l.foodId);
            return (
              <li key={l.foodId} className="flex gap-4 rounded-2xl border bg-card p-3 shadow-soft">
                <FoodImage path={l.imagePath} alt={l.name} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-sm text-muted-foreground">{formatINR(price)} each</p>
                    </div>
                    <button onClick={() => cart.remove(l.foodId)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${l.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {issue && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> {issue}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1 rounded-full border p-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => cart.setQuantity(l.foodId, l.quantity - 1)} aria-label="Decrease">
                        <Minus />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold">{l.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => cart.setQuantity(l.foodId, l.quantity + 1)} disabled={l.quantity >= max} aria-label="Increase">
                        <Plus />
                      </Button>
                    </div>
                    <span className="font-semibold">{formatINR(price * l.quantity)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-soft lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted-foreground">Items</span>
            <span>{cart.count}</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatINR(total)}</span>
          </div>
          {issues.size > 0 && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Fix the highlighted items before checkout.
            </p>
          )}
          <Button asChild={issues.size === 0} disabled={issues.size > 0} size="lg" className="mt-4 w-full">
            {issues.size === 0 ? <Link to="/checkout">Proceed to checkout</Link> : <span>Proceed to checkout</span>}
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link to="/menu">Add more items</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
