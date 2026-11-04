// Worker clock: Unix seconds and UTC day numbers.
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
export const dayOf = (seconds: number): number => Math.floor(seconds / 86_400);
