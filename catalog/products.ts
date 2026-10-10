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
  // Juice Bar: sold from the Corner Shop's stand shapes
  apple: { name: 'Apple', model: 'apple', shelf: 'tomato-stand', price: 3, breakChance: 0.2 },
  orange: { name: 'Orange', model: 'orange', shelf: 'tomato-stand', price: 4, breakChance: 0.2 },
  apple_juice: { name: 'Apple juice', model: 'apple-juice', shelf: 'milk-stand', price: 6, breakChance: 0.6 },
  orange_juice: { name: 'Orange juice', model: 'orange-juice', shelf: 'milk-stand', price: 8, breakChance: 0.6 },
  sugar_cane: { name: 'Sugar cane', model: 'sugar-cane', shelf: 'wheat-stand', price: 2, breakChance: 0.05 },
  sugar: { name: 'Sugar', model: 'sugar', shelf: 'flour-stand', price: 8, breakChance: 0.5 },
  candy_apple: { name: 'Candy apple', model: 'candy-apple', shelf: 'egg-stand', price: 16, breakChance: 0.4 },
  strawberry: { name: 'Strawberry', model: 'strawberry', shelf: 'tomato-stand', price: 5, breakChance: 0.8 },
  smoothie: { name: 'Smoothie', model: 'smoothie', shelf: 'ketchup-stand', price: 24, breakChance: 0.7 },
} satisfies Record<string, Product>;

export type ProductId = keyof typeof PRODUCTS;

/** Items a Shelf holds, by stand: one per spot its stand lays out (src/view/stands.ts), so full looks full. */
export const SHELF_CAPS: Record<string, number> = {
  'tomato-stand': 10,
  'egg-stand': 12,
  'ketchup-stand': 15,
  'wheat-stand': 12,
  'milk-stand': 12,
  'flour-stand': 15,
  'bread-stand': 12,
};
