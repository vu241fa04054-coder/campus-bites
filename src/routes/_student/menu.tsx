import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { FoodImage, PageTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/format";
import { categoriesQuery, foodItemsQuery, isInStock, type FoodItem } from "@/lib/menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/menu")({
  head: () => ({
    meta: [
      { title: "Menu — CampusBite" },
      { name: "description", content: "Browse today's canteen menu with live stock and add items to your cart." },
      { property: "og:title", content: "Menu — CampusBite" },
      { property: "og:description", content: "Browse today's canteen menu with live stock." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { name } = useAuth();
  const queryClient = useQueryClient();
  const foods = useQuery(foodItemsQuery);
  const cats = useQuery(categoriesQuery);
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  // Live stock updates.
  useEffect(() => {
    const channel = supabase
      .channel(`menu-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_items" }, () =>
        queryClient.invalidateQueries({ queryKey: ["food-items"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const catName = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c.name])), [cats.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (foods.data ?? []).filter(
      (f) =>
        (category === "all" || f.category_id === category) &&
        (!q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)),
    );
  }, [foods.data, search, category]);

  return (
    <div className="pb-24">
      <PageTitle title={`Hi${name ? `, ${name.split(" ")[0]}` : ""}! What's for today?`} subtitle="Order ahead and pick up at your chosen time." />

      <div className="sticky top-16 z-30 -mx-4 mb-6 space-y-3 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dosa, chai, biryani…"
            className="h-11 rounded-full pl-10"
            aria-label="Search food"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: "all", name: "All" }, ...(cats.data ?? [])].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                category === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {foods.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : foods.isError ? (
        <p className="text-destructive">Could not load the menu. Please refresh.</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          No items match your search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FoodCard key={f.id} item={f} category={f.category_id ? catName.get(f.category_id) : undefined} />
          ))}
        </div>
      )}

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <Button asChild variant="hero" size="lg" className="w-full max-w-md justify-between">
            <Link to="/cart">
              <span className="flex items-center gap-2">
                <ShoppingCart /> {cart.count} item{cart.count > 1 ? "s" : ""}
              </span>
              <span>View cart · {formatINR(cart.subtotal)}</span>
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function FoodCard({ item, category }: { item: FoodItem; category?: string | undefined }) {
  const cart = useCart();
  const qty = cart.quantityOf(item.id);
  const inStock = isInStock(item);

  const add = () => {
    const ok = cart.add({ foodId: item.id, name: item.name, price: item.price, imagePath: item.image_path, stock: item.stock });
    if (!ok) toast.error(`Only ${item.stock} available for ${item.name}`);
  };

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift", !inStock && "opacity-75")}>
      <div className="relative aspect-[4/3] bg-muted">
        <FoodImage path={item.image_path} alt={item.name} className="h-full w-full" />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-soft",
            inStock ? "bg-card text-primary" : "bg-destructive text-destructive-foreground",
          )}
        >
          {inStock ? "Available" : "Out of Stock"}
        </span>
        {category && (
          <span className="absolute right-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{item.name}</h3>
          <span className="shrink-0 font-display text-lg font-bold text-primary">{formatINR(item.price)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className={cn("text-xs font-medium", inStock ? (item.stock <= 5 ? "text-accent" : "text-muted-foreground") : "text-destructive")}>
            {inStock ? `${item.stock} in stock` : item.is_available ? "Sold out" : "Unavailable today"}
          </span>
          {qty === 0 ? (
            <Button size="sm" onClick={add} disabled={!inStock} className="rounded-full">
              <Plus /> Add
            </Button>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-primary-soft p-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => cart.setQuantity(item.id, qty - 1)} aria-label={`Decrease ${item.name}`}>
                <Minus />
              </Button>
              <span className="w-6 text-center text-sm font-bold text-primary">{qty}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={add} disabled={qty >= item.stock} aria-label={`Increase ${item.name}`}>
                <Plus />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
