import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type FoodItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  is_available: boolean;
  image_path: string | null;
  category_id: string | null;
};

export type Category = { id: string; name: string; sort_order: number };

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase.from("categories").select("id, name, sort_order").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const foodItemsQuery = queryOptions({
  queryKey: ["food-items"],
  queryFn: async (): Promise<FoodItem[]> => {
    const { data, error } = await supabase
      .from("food_items")
      .select("id, name, description, price, stock, is_available, image_path, category_id")
      .order("name");
    if (error) throw error;
    return data.map((d) => ({ ...d, price: Number(d.price) }));
  },
});

export function isInStock(item: Pick<FoodItem, "stock" | "is_available">) {
  return item.is_available && item.stock > 0;
}
