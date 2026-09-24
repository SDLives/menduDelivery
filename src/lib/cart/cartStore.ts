import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  observacoes?: string;
}

interface CartState {
  storeId: string | null;
  items: CartItem[];
  addItem: (storeId: string, item: CartItem) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  storeId: null,
  items: [],
  addItem: (storeId, item) =>
    set((state) => {
      if (state.storeId && state.storeId !== storeId) {
        return { storeId, items: [item] };
      }
      return { storeId, items: [...state.items, item] };
    }),
  removeItem: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ storeId: null, items: [] }),
}));
