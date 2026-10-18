// Objective kinds shared by every Map; each Map lists its own in maps/<id>/objectives.ts.
export type ObjectiveDef =
  | { kind: 'sell'; product: string; n: number }
  | { kind: 'earn'; n: number }
  | { kind: 'deliveries'; n: number }
  | { kind: 'own'; id: string };

export const sell = (product: string, n: number): ObjectiveDef => ({ kind: 'sell', product, n });
export const earn = (n: number): ObjectiveDef => ({ kind: 'earn', n });
export const deliveries = (n: number): ObjectiveDef => ({ kind: 'deliveries', n });
export const own = (id: string): ObjectiveDef => ({ kind: 'own', id });

/** Stable save key: the same goal always has the same id. */
export function objectiveId(o: ObjectiveDef): string {
  switch (o.kind) {
    case 'sell':
      return `sell:${o.product}:${o.n}`;
    case 'own':
      return `own:${o.id}`;
    default:
      return `${o.kind}:${o.n}`;
  }
}
