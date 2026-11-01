// PROTOTYPE (#138, branch prototype/daily-map): `?daily=slabs|kit` — the Daily Map generator. Pick a day, see the
// generated Map from above with its Opening (bought Pads shaded), its goal, the validator's verdict and the bot's time;
// Play loads it in the real game with a Shift chip (goal progress + time). `&gallery=1` shows 12 days side by side.
// lil-gui tunes the generator; "Dump values" prints the knobs as JSON.
import GUI from 'lil-gui';
import { MAPS } from '../../maps';
import { ASSETS } from '../../catalog/assets';
import { validateMap } from '../sim/validate';
import { objectiveProgress } from '../sim/objectives';
import type { World } from '../sim/world';
import type { MapDef } from '../sim/map';
import {
  KNOBS,
  calibrate,
  dateSeed,
  generateDaily,
  goalText,
  type Calibration,
  type Generated,
  type Variant,
} from '../sim/daily-map.prototype';

interface AppGuts {
  play(id: string): void;
  game?: { world: World };
}

const VARIANTS: Record<Variant, string> = {
  slabs: 'Slabs — 2–3 Areas, one random Chain each',
  kit: 'Kit — one packed Area, two Chains',
};
const LAUNCH = '2027-01-01';
const params = new URLSearchParams(location.search);
const variant = ((params.get('daily') ?? '') in VARIANTS ? params.get('daily') : 'slabs') as Variant;
let date = params.get('date') ?? new Date().toISOString().slice(0, 10);
const dayNumber = (d: string) => Math.round((Date.parse(d) - Date.parse(LAUNCH)) / 864e5) + 1;
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const cache = new Map<string, Calibration>();
const key = (d: string) => `${variant}|${d}|${JSON.stringify(KNOBS)}`;

const CSS = `
.dp{position:fixed;inset:0;z-index:50;background:#f4efe6ee;overflow:auto;font:14px/1.35 system-ui,sans-serif;color:#2b2622;padding:12px 16px 80px}
.dp h1{font-size:18px;margin:0 0 8px}.dp .row{display:flex;gap:16px;flex-wrap:wrap}
.dp .plan{flex:1 1 560px;min-width:0;background:#fff;border-radius:12px;padding:8px}
.dp .plan svg{width:100%;height:auto;display:block}
.dp .card{flex:0 1 360px;background:#fff;border-radius:12px;padding:12px}
.dp .goal{background:#fff6d8;border:2px solid #e3b23c;border-radius:10px;padding:10px;margin:8px 0}
.dp .goal li{font-weight:600;margin:2px 0}.dp .muted{color:#7a7066;font-size:12px}
.dp button{font:inherit;padding:8px 12px;border-radius:8px;border:0;background:#3b6ea5;color:#fff;margin:2px}
.dp button.alt{background:#ddd;color:#222}.dp .bad{color:#b3261e}.dp .ok{color:#2e7d32}
.dp .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.dp .grid .cell{background:#fff;border-radius:10px;padding:8px;cursor:pointer}
.dp-bar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;gap:6px;justify-content:center;padding:8px;background:#2b2622e6}
.dp-bar a{color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;font:13px system-ui}.dp-bar a.on{background:#3b6ea5}
.dp-chip{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:40;background:#fff6d8;border:2px solid #e3b23c;border-radius:10px;padding:6px 10px;font:13px system-ui;color:#2b2622;pointer-events:none}
.lil-gui.root{z-index:70}`;

function plan(g: Generated, w = 900): string {
  const L = g.map.layout;
  const [W, H] = L.size;
  const s = w / W;
  const r = (b: number[], fill: string, extra = '') =>
    `<rect x="${b[0] * s}" y="${b[1] * s}" width="${b[2] * s}" height="${b[3] * s}" fill="${fill}" ${extra}/>`;
  const t = (x: number, z: number, txt: string, size = 9, fill = '#2b2622') =>
    `<text x="${x * s}" y="${z * s}" font-size="${size}" text-anchor="middle" fill="${fill}">${txt}</text>`;
  const out: string[] = [r([0, 0, W, H], '#cfe3b5')];
  for (const b of L.street) out.push(r(b, '#d9d4cc'));
  for (const b of L.roads) out.push(r(b, '#8a8580'));
  const tint = ['#fbe9c6', '#e6f0fa', '#f3e3f5'];
  Object.values(L.areas).forEach((boxes, i) => boxes.forEach((b) => out.push(r(b, tint[i % 3], 'opacity=".9"'))));
  for (const f of L.floors) out.push(r(f, 'none', 'stroke="#b9a68a" stroke-dasharray="4 3"'));
  for (const wl of Object.values(L.walls)) out.push(r(wl.box, wl.kind === 'tall' ? '#6b5a48' : '#9c8b77'));
  for (const d of Object.values(L.doors)) out.push(r(d.box, d.kind === 'customer' ? '#57b36b' : '#e3b23c'));
  for (const p of Object.values(L.props)) out.push(r(p.box, '#7da35f', 'rx="3"'));
  const owned = new Set(g.map.start.owned);
  const goalIds = new Set((cache.get(key(date))?.goal ?? []).flatMap((o) => (o.kind === 'own' ? [o.id] : [])));
  const all = { ...g.map.pads, ...g.map.freeStations };
  for (const [id, def] of Object.entries(all)) {
    const pl = L.places[id];
    if (!pl) continue;
    const u = def.unlocks;
    const bought = owned.has(id) || !('cost' in def);
    const color =
      u.kind === 'shelf' ? '#e07a5f'
      : u.kind === 'producer' ? (g.map.producers[u.type].kind === 'crop' ? '#81b29a' : g.map.producers[u.type].kind === 'animal' ? '#c9a227' : '#7b8cde')
      : u.kind === 'register' ? '#444' : u.kind === 'exit' ? '#111' : '#a39b93';
    const stroke = goalIds.has(id) ? 'stroke="#e3b23c" stroke-width="4"' : 'stroke="#fff" stroke-width="1"';
    out.push(r(pl.box, color, `${stroke} opacity="${bought ? 1 : 0.35}" rx="2"`));
    const [x, z, bw, bd] = pl.box;
    const label =
      u.kind === 'shelf' ? g.map.products[u.product].name
      : u.kind === 'producer' ? g.map.producers[u.type].name
      : u.kind === 'area' ? `Area ${u.area.slice(5)}` : id.replace(/_\d$/, '').replace(/_/g, ' ');
    out.push(t(x + bw / 2, z + bd / 2 + 0.3, label, 8.5));
    if ('cost' in def && !owned.has(id)) out.push(t(x + bw / 2, z + bd / 2 + 1.3, `$${def.cost}`, 8, '#7a2e1e'));
  }
  out.push(`<circle cx="${L.playerStart[0] * s}" cy="${L.playerStart[1] * s}" r="5" fill="#3b6ea5"/>`);
  return `<svg viewBox="0 0 ${w} ${H * s}" xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`;
}

function card(g: Generated, c: Calibration | undefined): string {
  const problems = validateMap(g.map, ASSETS);
  const m = g.map;
  const sold = Object.values(m.pads).flatMap((p) => (p.unlocks.kind === 'shelf' ? [m.products[p.unlocks.product].name] : []));
  const left = Object.keys(m.pads).filter((id) => !m.start.owned.includes(id));
  const goal = c
    ? `<ol>${c.goal.map((o, i) => `<li>${goalText(o, m)} <span class="muted">bot ${(c.partSeconds[i] / 60).toFixed(1)} min</span></li>`).join('')}</ol>
       <div>Bot finishes in <b>${c.botSeconds < 0 ? 'DNF' : (c.botSeconds / 60).toFixed(1) + ' min'}</b>
       <span class="muted">(target ${KNOBS.targetMinutes} × pace ${KNOBS.botPace})</span></div>`
    : `<div class="muted">Goal comes from a bot run (~2 s).</div><button id="dp-cal">Run bot → goal</button>`;
  return `
    <h1>Daily Shift #${dayNumber(date)} <span class="muted">${date} · seed ${(g.seed >>> 0).toString(16)}</span></h1>
    <div><button class="alt" id="dp-prev">◀ day</button><button class="alt" id="dp-next">day ▶</button>
      <input type="date" id="dp-date" value="${date}"></div>
    <div class="goal"><b>Today's goal</b>${goal}</div>
    <div><b>${g.format}</b> · interiors ${g.interiors.join(', ')}${g.rerolls ? ` · ${g.rerolls} rerolls` : ''}</div>
    <div>${Object.keys(m.layout.areas).length} Areas · ${Object.keys(m.producers).length} Producers · ${sold.length} Shelves</div>
    <div class="muted">Sells ${[...new Set(sold)].join(', ')}</div>
    <div>Opening: ${m.start.owned.length - 1} Pads bought, $${m.start.money}; ${left.length} Pads left
      (${left.filter((id) => m.pads[id].unlocks.kind === 'stocker').length} Stocker, ${left.filter((id) => m.pads[id].unlocks.kind === 'cashier').length} Cashier)</div>
    <div>Validator: ${problems.length ? `<span class="bad">${problems.map((p) => `${p.id}: ${p.message}`).join('<br>')}</span>` : '<span class="ok">valid</span>'}</div>
    <div style="margin-top:10px"><button id="dp-play" ${c ? '' : 'disabled'}>▶ Play this Shift</button>
      <button class="alt" id="dp-dump">Dump values</button></div>
    <pre id="dp-out" class="muted" style="white-space:pre-wrap"></pre>`;
}

export function openDailyPrototype(app: AppGuts): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.className = 'dp';
  document.body.append(root);
  const bar = document.createElement('div');
  bar.className = 'dp-bar';
  const link = (v: string, gallery: boolean) => {
    const p = new URLSearchParams(location.search);
    p.set('daily', v);
    if (gallery) p.set('gallery', '1');
    else p.delete('gallery');
    return `?${p}`;
  };
  bar.innerHTML =
    (Object.keys(VARIANTS) as Variant[])
      .map((v) => `<a class="${v === variant && !params.has('gallery') ? 'on' : ''}" href="${link(v, false)}" title="${VARIANTS[v]}">${v}</a>`)
      .join('') + `<a class="${params.has('gallery') ? 'on' : ''}" href="${link(variant, true)}">gallery</a>`;
  document.body.append(bar);

  const gui = new GUI({ title: 'Daily generator' });
  for (const k of Object.keys(KNOBS) as (keyof typeof KNOBS)[]) gui.add(KNOBS, k).onFinishChange(() => render());
  gui.close();

  const render = () => (params.has('gallery') ? gallery() : single());

  function single() {
    const g = generateDaily(dateSeed(date), variant);
    const c = cache.get(key(date));
    root.innerHTML = `<div class="muted">${VARIANTS[variant]}</div><div class="row"><div class="plan">${plan(g)}</div><div class="card">${card(g, c)}</div></div>`;
    const go = (d: string) => {
      date = d;
      render();
    };
    root.querySelector('#dp-prev')?.addEventListener('click', () => go(addDays(date, -1)));
    root.querySelector('#dp-next')?.addEventListener('click', () => go(addDays(date, 1)));
    root.querySelector<HTMLInputElement>('#dp-date')?.addEventListener('change', (e) => go((e.target as HTMLInputElement).value));
    root.querySelector('#dp-cal')?.addEventListener('click', (e) => {
      (e.target as HTMLButtonElement).textContent = 'Bot playing…';
      setTimeout(() => {
        cache.set(key(date), calibrate(g));
        render();
      }, 30);
    });
    root.querySelector('#dp-play')?.addEventListener('click', () => c && play(g, c));
    root.querySelector('#dp-dump')?.addEventListener('click', () => {
      const dump = JSON.stringify({ variant, date, knobs: KNOBS, goal: c?.goal, botSeconds: c?.botSeconds }, null, 2);
      console.log(dump);
      const out = root.querySelector('#dp-out');
      if (out) out.textContent = dump;
      void navigator.clipboard?.writeText(dump).catch(() => {});
    });
  }

  function gallery() {
    const days = [...Array(12)].map((_, i) => addDays(date, i));
    root.innerHTML = `<h1>${VARIANTS[variant]} — 12 days from ${date}</h1><div class="grid">${days
      .map((d) => {
        const g = generateDaily(dateSeed(d), variant);
        const ok = validateMap(g.map, ASSETS).length === 0;
        return `<div class="cell" data-d="${d}"><b>#${dayNumber(d)}</b> ${d} <b>${g.format}</b> <span class="${ok ? 'ok' : 'bad'}">${ok ? 'valid' : 'INVALID'}</span>
          ${plan(g, 300)}<div class="goal" id="g-${d}"><span class="muted">bot…</span></div></div>`;
      })
      .join('')}</div>`;
    root.querySelectorAll<HTMLElement>('.cell').forEach((el) =>
      el.addEventListener('click', () => {
        params.delete('gallery');
        history.replaceState(null, '', `?${params}`);
        date = el.dataset.d ?? date;
        render();
      }),
    );
    // calibrate one day per frame-ish so the page stays alive
    let i = 0;
    const next = () => {
      const d = days[i++];
      if (!d) return;
      const g = generateDaily(dateSeed(d), variant);
      const c = cache.get(key(d)) ?? calibrate(g);
      cache.set(key(d), c);
      const el = root.querySelector(`#g-${d}`);
      if (el)
        el.innerHTML = `${c.goal.map((o) => goalText(o, g.map)).join(' · ')}<div class="muted">bot ${(c.botSeconds / 60).toFixed(1)} min</div>`;
      setTimeout(next, 20);
    };
    setTimeout(next, 50);
  }

  function play(g: Generated, c: Calibration) {
    const map: MapDef = { ...g.map, objectives: c.goal };
    const i = MAPS.findIndex((m) => m.id === map.id);
    if (i >= 0) MAPS.splice(i, 1);
    MAPS.push(map);
    root.remove();
    bar.remove();
    gui.destroy();
    app.play(map.id);
    const chip = document.createElement('div');
    chip.className = 'dp-chip';
    document.body.append(chip);
    let doneAt: number | null = null;
    const tick = () => {
      const w = app.game?.world;
      if (w && w.map.id === map.id) {
        const parts = c.goal.map((o) => {
          const { got, want } = objectiveProgress(w, o);
          return `${got >= want ? '✅' : '⬜'} ${goalText(o, map)} ${o.kind === 'own' ? '' : `${Math.floor(got)}/${want}`}`;
        });
        if (doneAt === null && c.goal.every((o) => { const p = objectiveProgress(w, o); return p.got >= p.want; })) doneAt = w.t;
        const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        chip.innerHTML = `<b>Shift #${dayNumber(date)}</b> ⏱ ${mmss(doneAt ?? w.t)} <span style="opacity:.7">(bot ${mmss(c.botSeconds)})</span><br>${parts.join('<br>')}${doneAt !== null ? '<br><b>🎉 Shift done!</b>' : ''}`;
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  render();
}
