import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCart } from "@/lib/cart";
import { foodItemsQuery, isInStock } from "@/lib/menu";

/** Compares the saved cart with live menu data (stock, price, availability). */
export function useCartIssues() {
  const cart = useCart();
  const foods = useQuery(foodItemsQuery);
  return useMemo(() => {
    const live = new Map((foods.data ?? []).map((f) => [f.id, f]));
    const issues = new Map<string, string>();
    if (foods.data) {
      for (const l of cart.lines) {
        const f = live.get(l.foodId);
        if (!f) issues.set(l.foodId, "No longer on the menu");
        else if (!isInStock(f)) issues.set(l.foodId, "Out of stock");
        else if (l.quantity > f.stock) issues.set(l.foodId, `Only ${f.stock} left`);
      }
    }
    const total = cart.lines.reduce((s, l) => s + l.quantity * (live.get(l.foodId)?.price ?? l.price), 0);
    return { issues, total, live, loading: foods.isLoading };
  }, [cart.lines, foods.data, foods.isLoading]);
}
