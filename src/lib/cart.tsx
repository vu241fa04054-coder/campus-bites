import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  foodId: string;
  name: string;
  price: number;
  imagePath: string | null;
  quantity: number;
  stock: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartLine, "quantity">) => boolean;
  setQuantity: (foodId: string, quantity: number) => void;
  remove: (foodId: string) => void;
  clear: () => void;
  quantityOf: (foodId: string) => number;
};

const STORAGE_KEY = "campusbite-cart-v1";
const MAX_PER_ITEM = 50;

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed)) setLines(parsed.filter((l) => l && l.foodId && l.quantity > 0));
      }
    } catch {
      // ignore corrupted cart
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const add = useCallback((item: Omit<CartLine, "quantity">) => {
    let ok = true;
    setLines((prev) => {
      const existing = prev.find((l) => l.foodId === item.foodId);
      const limit = Math.min(item.stock, MAX_PER_ITEM);
      if (existing) {
        if (existing.quantity >= limit) {
          ok = false;
          return prev;
        }
        return prev.map((l) =>
          l.foodId === item.foodId ? { ...l, ...item, quantity: l.quantity + 1 } : l,
        );
      }
      if (limit < 1) {
        ok = false;
        return prev;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    return ok;
  }, []);

  const setQuantity = useCallback((foodId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.foodId !== foodId)
        : prev.map((l) =>
            l.foodId === foodId
              ? { ...l, quantity: Math.min(quantity, Math.max(l.stock, 1), MAX_PER_ITEM) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((foodId: string) => {
    setLines((prev) => prev.filter((l) => l.foodId !== foodId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: lines.reduce((s, l) => s + l.quantity * l.price, 0),
      add,
      setQuantity,
      remove,
      clear,
      quantityOf: (id) => lines.find((l) => l.foodId === id)?.quantity ?? 0,
    }),
    [lines, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
