import React, { createContext, useContext, useState, useCallback } from 'react';
import { Product } from '@/lib/supabase';

export type CartItem = {
  product: Product;
  quantity: number;
  selectedColor?: { name: string; hex: string; image_url?: string | null; stock?: number | null } | null;
};

type AddToCartResult = { ok: true } | { ok: false; reason: string; available: number };

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, color?: CartItem['selectedColor']) => AddToCartResult;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number, colorName?: string | null) => { ok: boolean; available?: number };
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function effectiveStock(product: Product, color?: CartItem['selectedColor'] | null): number {
  if (product.unlimited_stock) return 9999;
  if (color && color.stock != null) return color.stock;
  return product.stock;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback(
    (product: Product, quantity: number = 1, color?: CartItem['selectedColor']): AddToCartResult => {
      const available = effectiveStock(product, color);

      let result: AddToCartResult = { ok: true };

      setItems((prev) => {
        const existing = prev.find(
          (i) =>
            i.product.id === product.id &&
            (i.selectedColor?.name ?? null) === (color?.name ?? null)
        );
        const currentQty = existing?.quantity ?? 0;
        const desired = currentQty + quantity;

        if (!product.unlimited_stock && desired > available) {
          result = { ok: false, reason: 'exceeds_stock', available };
          if (available <= currentQty) return prev; // already at max
          // add up to available
          return prev.map((i) =>
            i.product.id === product.id &&
            (i.selectedColor?.name ?? null) === (color?.name ?? null)
              ? { ...i, quantity: available }
              : i
          );
        }

        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id &&
            (i.selectedColor?.name ?? null) === (color?.name ?? null)
              ? { ...i, quantity: desired }
              : i
          );
        }
        return [...prev, { product, quantity: Math.min(quantity, available || quantity), selectedColor: color ?? null }];
      });

      return result;
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number, colorName?: string | null): { ok: boolean; available?: number } => {
      const item = items.find(
        (i) =>
          i.product.id === productId &&
          (colorName === undefined || (i.selectedColor?.name ?? null) === (colorName ?? null))
      );
      if (!item) {
        if (quantity <= 0) {
          setItems((prev) => prev.filter((i) => i.product.id !== productId));
        }
        return { ok: true };
      }

      const available = effectiveStock(item.product, item.selectedColor);

      if (!item.product.unlimited_stock && quantity > available) {
        setItems((prev) =>
          prev.map((i) =>
            i.product.id === productId &&
            (colorName === undefined || (i.selectedColor?.name ?? null) === (colorName ?? null))
              ? { ...i, quantity: available }
              : i
          )
        );
        return { ok: false, available };
      }

      if (quantity <= 0) {
        setItems((prev) => prev.filter((i) => !(
          i.product.id === productId &&
          (colorName === undefined || (i.selectedColor?.name ?? null) === (colorName ?? null))
        )));
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.product.id === productId &&
            (colorName === undefined || (i.selectedColor?.name ?? null) === (colorName ?? null))
              ? { ...i, quantity }
              : i
          )
        );
      }
      return { ok: true };
    },
    [items]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
