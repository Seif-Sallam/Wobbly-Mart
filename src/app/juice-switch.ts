// PROTOTYPE (prototype/juice-layout): a floating A / B / C / saved bar to swap the Juice Bar's store shape.
export function installJuiceSwitch(): void {
  const params = new URLSearchParams(location.search);
  const now = params.get('jlayout') ?? 'A';
  const bar = document.createElement('div');
  bar.style.cssText =
    'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:50;display:flex;gap:6px;background:#111;' +
    'padding:6px 10px;border-radius:999px;font:600 14px system-ui;color:#fff;align-items:center;white-space:nowrap';
  bar.append('Shape');
  for (const [k, label] of [
    ['A', 'A Corner L'],
    ['B', 'B Island'],
    ['C', 'C Stairs'],
    ['saved', 'Editor save'],
  ]) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `border:0;border-radius:999px;padding:4px 10px;cursor:pointer;font:inherit;${k === now ? 'background:#2f9e4f;color:#fff' : 'background:#fff1d0;color:#3a2416'}`;
    b.onclick = () => {
      params.set('map', 'juice-bar');
      params.set('jlayout', k);
      location.search = params.toString();
    };
    bar.append(b);
  }
  document.body.append(bar);
}
