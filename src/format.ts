/** $2,100 up to 9,999, then 12.5K, 3.4M. */
export function formatMoney(n: number): string {
  const v = Math.floor(n);
  if (v < 10000) return `$${v.toLocaleString('en-US')}`;
  if (v < 1e6) return `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `$${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}
