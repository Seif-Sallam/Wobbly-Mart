import type { ProductId } from './products';

export type ProducerKind = 'crop' | 'animal' | 'machine';

export interface ProducerType<P extends string = string> {
  kind: ProducerKind;
  name: string;
  model: string;
  inputs: P[];
  output: P;
  /** Crop: seconds for one plant to regrow. Animal/Machine: seconds per output. */
  workTime: number;
  plants?: number;
  inputCap?: number;
  trayCap?: number;
}

export const PRODUCERS = {
  tomato_bed: {
    kind: 'crop',
    name: 'Tomato bed',
    model: 'tomato-bed',
    inputs: [],
    output: 'tomato',
    workTime: 6,
    plants: 4,
  },
  chicken_coop: {
    kind: 'animal',
    name: 'Chicken Coop',
    model: 'chicken-coop',
    inputs: ['tomato'],
    output: 'egg',
    workTime: 4,
    inputCap: 6,
    trayCap: 6,
  },
  blender: {
    kind: 'machine',
    name: 'Blender',
    model: 'blender',
    inputs: ['tomato'],
    output: 'ketchup',
    workTime: 3,
    inputCap: 6,
    trayCap: 6,
  },
  wheat_field: {
    kind: 'crop',
    name: 'Wheat field',
    model: 'wheat-field',
    inputs: [],
    output: 'wheat',
    workTime: 7,
    plants: 4,
  },
  cow_pen: {
    kind: 'animal',
    name: 'Cow pen',
    model: 'cow-pen',
    inputs: ['wheat'],
    output: 'milk',
    workTime: 5,
    inputCap: 6,
    trayCap: 6,
  },
  mill: {
    kind: 'machine',
    name: 'Mill',
    model: 'mill',
    inputs: ['wheat'],
    output: 'flour',
    workTime: 4,
    inputCap: 6,
    trayCap: 6,
  },
  oven: {
    kind: 'machine',
    name: 'Oven',
    model: 'oven',
    inputs: ['flour', 'egg'],
    output: 'bread',
    workTime: 6,
    inputCap: 4,
    trayCap: 6,
  },
} satisfies Record<string, ProducerType<ProductId>>;

export type ProducerTypeId = keyof typeof PRODUCERS;
