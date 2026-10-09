export interface Product {
  name: string;
  model: string;
  /** Shelf stand this Product is sold from (code-built, see src/view/stands.ts). */
  shelf: string;
  price: number;
  /** Chance a tipped Item breaks into a Mess instead of landing Loose. */
  breakChance: number;
}

export const PRODUCTS = {
  tomato: { name: 'Tomato', model: 'tomato', shelf: 'tomato-stand', price: 3, breakChance: 0.7 },
  egg: { name: 'Egg', model: 'egg', shelf: 'egg-stand', price: 5, breakChance: 0.9 },
  ketchup: { name: 'Ketchup', model: 'ketchup', shelf: 'ketchup-stand', price: 6, breakChance: 0.25 },
  wheat: { name: 'Wheat', model: 'wheat', shelf: 'wheat-stand', price: 4, breakChance: 0.05 },
  milk: { name: 'Milk', model: 'milk', shelf: 'milk-stand', price: 7, breakChance: 0.3 },
  flour: { name: 'Flour', model: 'flour', shelf: 'flour-stand', price: 8, breakChance: 0.5 },
  bread: { name: 'Bread', model: 'bread', shelf: 'bread-stand', price: 20, breakChance: 0.05 },
} satisfies Record<string, Product>;

export type ProductId = keyof typeof PRODUCTS;
