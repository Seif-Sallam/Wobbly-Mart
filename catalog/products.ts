export interface Product {
  name: string;
  model: string;
  /** Shelf model this Product is sold from. */
  shelf: string;
  price: number;
}

export const PRODUCTS = {
  tomato: { name: 'Tomato', model: 'tomato', shelf: 'display-fruit', price: 3 },
  egg: { name: 'Egg', model: 'egg', shelf: 'display-fruit', price: 5 },
  ketchup: { name: 'Ketchup', model: 'ketchup', shelf: 'shelf-boxes', price: 6 },
  wheat: { name: 'Wheat', model: 'wheat', shelf: 'shelf-bags', price: 4 },
  milk: { name: 'Milk', model: 'milk', shelf: 'freezers-standing', price: 7 },
  flour: { name: 'Flour', model: 'flour', shelf: 'shelf-boxes', price: 8 },
  bread: { name: 'Bread', model: 'bread', shelf: 'display-bread', price: 20 },
} satisfies Record<string, Product>;

export type ProductId = keyof typeof PRODUCTS;
