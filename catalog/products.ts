export interface Product {
  name: string;
  model: string;
  /** Shelf stand this Product is sold from (code-built, see src/view/stands.ts). */
  shelf: string;
  price: number;
}

export const PRODUCTS = {
  tomato: { name: 'Tomato', model: 'tomato', shelf: 'tomato-stand', price: 3 },
  egg: { name: 'Egg', model: 'egg', shelf: 'egg-stand', price: 5 },
  ketchup: { name: 'Ketchup', model: 'ketchup', shelf: 'ketchup-stand', price: 6 },
  wheat: { name: 'Wheat', model: 'wheat', shelf: 'wheat-stand', price: 4 },
  milk: { name: 'Milk', model: 'milk', shelf: 'milk-stand', price: 7 },
  flour: { name: 'Flour', model: 'flour', shelf: 'flour-stand', price: 8 },
  bread: { name: 'Bread', model: 'bread', shelf: 'bread-stand', price: 20 },
} satisfies Record<string, Product>;

export type ProductId = keyof typeof PRODUCTS;
