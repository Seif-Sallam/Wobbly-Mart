// PROTOTYPE (throwaway, branch prototype/score-ui): `?score=A|B|C` — where Objectives, Challenges, Score and Stats
// show, portrait and phone landscape (add `&land=C3`). All numbers are mock data; nothing is saved.
// A = Score pill + Office tabs, B = Trophy button + Logbook, C = Quest tracker + Progress in the pause menu.
// `&gallery=1` lays every variant's pieces side by side. Bar: ◀ ▶ switch, Challenge / +1 / Objective drive the demo.
import type { World } from '../sim/world';
import type { Game } from './game';
import { cellCentre, nearestFreeCell } from '../sim/nav';
import { boxCentre } from '../sim/geometry';
import { iconUrl, emojiUrl } from '../view/thumbs';
import { formatMoney } from '../format';

interface AppGuts {
  game: Game | null;
  ui: { screen: string; overlay: string | null; maps: { map: { id: string; name: string }; visited: boolean }[] };
  play(id: string): void;
  save: { currentMap: string };
}

type Variant = 'A' | 'B' | 'C';
const NAMES: Record<Variant, string> = { A: 'Score pill + Office tabs', B: 'Trophy + Logbook', C: 'Quest tracker' };
const VARIANTS = Object.keys(NAMES) as Variant[];

const P = {
  toastMs: 2200,
  /** Seconds of Challenge time per real second (speeds up the demo). */
  clock: 1,
  /** C: Objectives pinned under the Challenge. */
  trackerRows: 2,
  trackerScale: 1,
  trackerSide: 'right' as 'right' | 'left',
  /** B: ring size px. */
  ringSize: 64,
  scoreScale: 1,
  /** Show done Objectives at the bottom of lists (else hide them). */
  showDone: true,
};

interface Objective {
  icon: string;
  label: string;
  got: number;
  want: number;
}
interface Challenge {
  icon: string;
  label: string;
  short: string;
  got: number;
  want: number;
  t: number;
  time: number;
  bonus: number;
}

const CSS = `
#sp-bar{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:90;display:flex;gap:6px;align-items:center;
  background:#222;color:#fff;font:600 13px system-ui;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px #0006;pointer-events:auto}
#sp-bar button{background:#444;color:#fff;border:0;border-radius:999px;padding:4px 10px;font:inherit}
.sp, .sp *{box-sizing:border-box}
.sp{font-family:Fredoka,system-ui;color:var(--ink)}
.sp-tap{pointer-events:auto;cursor:pointer}
.sp-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;background:#fff8e6;border:2px solid #3a241633}
.sp-row img{width:30px;height:30px;flex:none}
.sp-row .sp-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;font:600 15px Fredoka}
.sp-row .sp-txt span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-row .sp-n{font:700 14px Fredoka;white-space:nowrap}
.sp-row.done{opacity:.55}
.sp-row.done .sp-n{color:var(--money)}
.sp-bar{height:8px;border-radius:99px;background:#3a241622;overflow:hidden}
.sp-bar b{display:block;height:100%;background:var(--orange);transition:width .3s}
.sp-row.done .sp-bar b{background:var(--money)}
.sp-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.sp-stats section{background:#fff8e6;border:2px solid #3a241633;border-radius:12px;padding:6px 10px}
.sp-stats h4{margin:0 0 4px;font:700 14px Fredoka;display:flex;gap:6px;align-items:center}
.sp-stats h4 img{width:20px;height:20px}
.sp-stats p{margin:0;display:flex;justify-content:space-between;font:500 13px Fredoka}
.sp-stats p b{font-weight:700}
.sp-seg{display:flex;gap:4px;background:#3a241618;border-radius:999px;padding:3px}
.sp-seg button{flex:1;border:0;border-radius:999px;background:none;font:600 15px Fredoka;color:var(--ink);padding:5px 10px;cursor:pointer}
.sp-seg button.on{background:var(--cream);box-shadow:0 2px 0 var(--ink)}
.sp-list{display:flex;flex-direction:column;gap:6px}
.sp-toast{position:absolute;left:50%;top:28%;transform:translateX(-50%);z-index:5;flex-direction:column;gap:2px;padding:10px 24px;
  font-size:24px;white-space:nowrap;animation:sp-toast var(--ms) both;text-align:center}
.sp-toast span{font-size:16px}
.sp-toast b{color:var(--money)}
.sp-toast.bad b{color:var(--angry)}
@keyframes sp-toast{0%{transform:translate(-50%,0) scale(.2)}10%{transform:translate(-50%,0) scale(1.12)}16%,88%{transform:translate(-50%,0) scale(1)}100%{transform:translate(-50%,0) scale(0)}}
@keyframes sp-bump{50%{transform:scale(1.25)}}
.bump2{animation:sp-bump .3s}

/* ---- A */
.sp-a-score{font-size:calc(20px * var(--ss));padding:2px 12px 2px 6px;gap:4px;pointer-events:none}
html:not(.pl) .sp-a-score{position:absolute;left:0;top:calc(100% + 8px)}
.sp-a-chip{border-color:var(--orange)!important;background:#fff1d0}
.sp-a-chip.win{background:#dff3c8}
.sp-a-tabs{margin:0 40px 8px 0}
.office .sp-pane{overflow:auto;flex:1;touch-action:pan-y;display:flex;flex-direction:column;gap:8px}
.sp-title-total{position:fixed;top:max(16px,env(safe-area-inset-top));left:max(16px,env(safe-area-inset-left));font-size:20px;
  padding:4px 14px 4px 8px;pointer-events:none}
.sp-card-score{font:700 15px Fredoka;color:var(--ink)}

/* ---- B */
.sp-b-trophy{position:relative;pointer-events:auto;font-size:24px;margin-left:auto;margin-right:8px}
.sp-b-badge{position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);background:var(--pad);border:2px solid var(--ink);
  border-radius:999px;font:700 calc(12px * var(--ss)) Fredoka;padding:0 6px;white-space:nowrap}
html:not(.pl) .hud-top .sp-b-trophy{position:absolute;right:58px;margin:0}
.sp-b-ring{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 64px);transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none}
html.pl .sp-b-ring{top:calc(max(10px,env(safe-area-inset-top)) + 8px)}
.sp-b-ring .ring{width:var(--rs);height:var(--rs);border-radius:50%;display:grid;place-items:center;border:3px solid var(--ink);
  box-shadow:0 4px 0 var(--ink);background:conic-gradient(var(--c) calc(var(--p) * 1turn), var(--cream) 0)}
.sp-b-ring .ring i{width:calc(var(--rs) - 16px);height:calc(var(--rs) - 16px);border-radius:50%;background:var(--cream);
  display:grid;place-items:center;font:700 16px Fredoka;font-style:normal}
.sp-b-ring small{background:var(--cream);border:2px solid var(--ink);border-radius:999px;padding:0 10px;font:600 13px Fredoka}
.sp-b-stamp{position:absolute;left:50%;top:35%;font:800 44px Fredoka;color:var(--orange);-webkit-text-stroke:2px var(--ink);
  transform:translateX(-50%) rotate(-8deg);animation:sp-stamp 1.2s both;pointer-events:none;white-space:nowrap}
@keyframes sp-stamp{0%{transform:translateX(-50%) rotate(-8deg) scale(3);opacity:0}15%{transform:translateX(-50%) rotate(-8deg) scale(1);opacity:1}80%{opacity:1}100%{opacity:0}}
.sp-b-fly{position:absolute;left:50%;top:30%;transform:translate(-50%,0);padding:8px 14px;font-size:18px;flex-direction:column;
  transition:left .6s cubic-bezier(.5,0,.8,.4),top .6s cubic-bezier(.5,0,.8,.4),transform .6s;z-index:5}
.sp-b-fly img{width:44px;height:44px}
.sp-modal{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:#3a241659;padding:16px;pointer-events:auto}
.sp-modal .panel{width:min(720px,100%);max-height:92vh}
html.pl .sp-modal .panel{max-height:96vh;padding:12px}
.sp-b-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.sp-b-head h2{margin:0!important;font-size:24px!important}
.sp-b-head .big{font:700 22px Fredoka}
.sp-b-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.sp-b-tile{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;border-radius:16px;background:#fff8e6;
  border:2px solid #3a241633;text-align:center;font:600 13px Fredoka}
.sp-b-tile .ring{--rs:54px;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;
  background:conic-gradient(var(--orange) calc(var(--p) * 1turn), #3a241622 0)}
.sp-b-tile .ring img{width:38px;height:38px;background:#fff8e6;border-radius:50%;padding:3px}
.sp-b-tile.done{background:#e9f6dc}
.sp-b-tile.done .ring{background:var(--money)}
.sp-ribbon{position:absolute;top:-10px;right:-10px;background:var(--pad);border:2px solid var(--ink);border-radius:999px;
  padding:1px 8px;font:700 14px Fredoka;transform:rotate(8deg)}
.sp-b-plaque{font-size:22px;padding:4px 16px 4px 10px;margin:-6px 0 4px;pointer-events:none}

/* ---- C */
.sp-c-tracker{position:absolute;top:calc(max(10px,env(safe-area-inset-top)) + 66px);width:230px;display:flex;flex-direction:column;
  gap:5px;transform:scale(var(--ts));pointer-events:auto}
.sp-c-tracker.right{right:max(12px,env(safe-area-inset-right));transform-origin:top right}
.sp-c-tracker.left{left:max(12px,env(safe-area-inset-left));transform-origin:top left}
html.pl .sp-c-tracker{top:calc(max(10px,env(safe-area-inset-top)) + 62px)}
.sp-c-tracker .sp-row{background:#fff1d0ee;border:2px solid var(--ink);padding:4px 8px;transition:transform .3s,opacity .3s}
.sp-c-tracker .sp-row img{width:24px;height:24px}
.sp-c-tracker .sp-row .sp-txt{font-size:13px}
.sp-c-tracker .sp-row.chal{background:#ffe2b8;border-color:var(--orange);border-width:3px}
.sp-c-tracker .sp-row.chal .sp-bar b{background:var(--orange)}
.sp-c-tracker .sp-row.gold{background:var(--pad);transform:scale(1.05)}
.sp-c-tracker .sp-row.out{transform:translateX(120%);opacity:0}
.sp-c-foot{display:flex;justify-content:space-between;align-items:center;font:700 15px Fredoka;background:#fff1d0ee;
  border:2px solid var(--ink);border-radius:12px;padding:2px 10px}
.sp-c-tracker.shut .sp-row{display:none}
.sp-c-float{position:absolute;font:800 20px Fredoka;color:var(--money);-webkit-text-stroke:1px var(--ink);animation:sp-float 1s both;
  pointer-events:none}
@keyframes sp-float{from{transform:translateY(0);opacity:1}to{transform:translateY(-40px);opacity:0}}
.sp-c-total{font:700 22px Fredoka;margin:-4px 0 6px;pointer-events:none;text-shadow:0 2px 0 #fff8}
.sp-c-objs{font:600 13px Fredoka;opacity:.8}
.sp-c-section h3{margin:4px 2px;font-size:16px}

/* ---- gallery */
#sp-gal{position:fixed;inset:0;z-index:85;overflow:auto;background:var(--sky);padding:12px 12px 70px;pointer-events:auto;touch-action:pan-y}
#sp-gal .cols{display:grid;grid-template-columns:repeat(3,minmax(300px,1fr));gap:12px;min-width:min(100%,936px)}
@media (max-width:940px){#sp-gal .cols{grid-template-columns:repeat(3,300px)}}
#sp-gal .col{background:#ffffff55;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:12px}
#sp-gal .col>h2{margin:0;font:700 20px Fredoka;display:flex;justify-content:space-between;align-items:center}
#sp-gal h5{margin:0 0 4px;font:600 12px system-ui;text-transform:uppercase;opacity:.6}
#sp-gal .frame{position:relative;background:#a3c94a;border:2px solid #3a241655;border-radius:12px;overflow:hidden;min-height:90px;padding:8px}
#sp-gal .frame .hud-top{position:relative;top:0;left:0;right:0}
#sp-gal .frame .sp-toast,#sp-gal .frame .sp-b-stamp,#sp-gal .frame .sp-b-ring{position:relative;left:auto;top:auto;transform:none;animation:none;display:inline-flex}
#sp-gal .frame .sp-c-tracker{position:relative;top:0;right:0;left:0;transform:none}
#sp-gal .frame .panel{width:100%;max-height:none;box-shadow:none}
#sp-gal .frame .shelf-card{position:relative;left:0;top:0;transform:none;opacity:1;margin:12px auto}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const n = (v: number) => v.toLocaleString('en-US');
const pct = (o: { got: number; want: number }) => Math.min(1, o.got / o.want);
const done = (o: Objective) => o.got >= o.want;

// ---------- mock data
function objectivesFor(w: World | null): Objective[] {
  const prods = w ? Object.values(w.map.products) : [];
  const p = (i: number) => prods[i % Math.max(1, prods.length)];
  const pi = (i: number) => (p(i) ? iconUrl(p(i).model) : emojiUrl('🥚'));
  const pn = (i: number) => p(i)?.name ?? 'Eggs';
  return [
    { icon: pi(0), label: `Sell 50 ${pn(0)}`, got: 32, want: 50 },
    { icon: pi(1), label: `Sell 30 ${pn(1)}`, got: 30, want: 30 },
    { icon: pi(2), label: `Make 40 ${pn(2)}`, got: 12, want: 40 },
    { icon: emojiUrl('💵'), label: 'Earn $5,000', got: 3120, want: 5000 },
    { icon: emojiUrl('🦹'), label: 'Catch 3 Thieves', got: 1, want: 3 },
    { icon: iconUrl('van') || emojiUrl('🚚'), label: 'Fill 5 Deliveries completely', got: 2, want: 5 },
    { icon: emojiUrl('📋'), label: 'Get 3 spotless inspections', got: 3, want: 3 },
    { icon: emojiUrl('🔑'), label: 'Own Area 2', got: 0, want: 1 },
    { icon: emojiUrl('📈'), label: 'Reach 50% Completion', got: 21, want: 50 },
    { icon: pi(0), label: `Sell 200 ${pn(0)}`, got: 32, want: 200 },
  ];
}
function challengesFor(w: World | null): Challenge[] {
  const prods = w ? Object.values(w.map.products) : [];
  const p = (i: number) => prods[i % Math.max(1, prods.length)];
  const pi = (i: number) => (p(i) ? iconUrl(p(i).model) : emojiUrl('🥚'));
  const pn = (i: number) => p(i)?.name ?? 'Eggs';
  const c = (icon: string, label: string, short: string, want: number, time: number): Challenge => ({
    icon,
    label,
    short,
    got: 0,
    want,
    t: 0,
    time,
    bonus: 40,
  });
  return [
    c(emojiUrl('🛒'), 'Check out 8 Customers in 60 s', 'Check out 8', 8, 60),
    c(emojiUrl('🧽'), 'No new Mess for 45 s', 'No Mess', 1, 45),
    c(pi(0), `Fill the ${pn(0)} Shelf in 40 s`, `Fill ${pn(0)} Shelf`, 1, 40),
    c(pi(1), `Make 6 ${pn(1)} in 50 s`, `Make 6 ${pn(1)}`, 6, 50),
    c(pi(2), `Sell 5 ${pn(2)} in 50 s`, `Sell 5 ${pn(2)}`, 5, 50),
    c(iconUrl('van') || emojiUrl('🚚'), 'Finish a Delivery with 30 s left', 'Delivery, 30 s left', 1, 90),
  ];
}
const STATS = (k: number) => [
  {
    icon: '📦',
    name: 'Items',
    rows: [
      ['Made', 1840 * k],
      ['Sold', 1712 * k],
      ['Trashed', 41 * k],
      ['Fell off', 96 * k],
    ],
  },
  {
    icon: '🧽',
    name: 'Messes',
    rows: [
      ['Made', 133 * k],
      ['Cleaned', 129 * k],
    ],
  },
  {
    icon: '💵',
    name: 'Money',
    rows: [
      ['Earned', formatMoney(48210 * k)],
      ['Fines', formatMoney(350 * k)],
    ],
  },
  {
    icon: '🛒',
    name: 'Customers',
    rows: [
      ['Served', 612 * k],
      ['Gave up', 38 * k],
    ],
  },
  {
    icon: '🚚',
    name: 'Deliveries',
    rows: [
      ['Filled', 14 * k],
      ['Partly', 6 * k],
      ['Missed', 3 * k],
    ],
  },
  {
    icon: '🦹',
    name: 'Robbery',
    rows: [
      ['Caught', 9 * k],
      ['Escaped', 2 * k],
    ],
  },
  {
    icon: '📋',
    name: 'Inspector',
    rows: [
      ['Spotless', 5 * k],
      ['Fined', 2 * k],
      ['Bad review', 1 * k],
    ],
  },
  {
    icon: '⏱',
    name: 'Challenges',
    rows: [
      ['Won', 11 * k],
      ['Failed', 4 * k],
    ],
  },
  { icon: '🕒', name: 'Play time', rows: [['', `${2 * k}h ${(17 * k) % 60}m`]] },
];

// ---------- shared pieces (HTML strings, reused by the game overlay and the gallery)
const objRow = (o: Objective) =>
  `<div class="sp-row ${done(o) ? 'done' : ''}"><img src="${o.icon}" alt=""><div class="sp-txt"><span>${o.label}</span>` +
  `<div class="sp-bar"><b style="width:${Math.round(pct(o) * 100)}%"></b></div></div><span class="sp-n">${done(o) ? '✓' : `${n(o.got)}/${n(o.want)}`}</span></div>`;
const sorted = (list: Objective[]) =>
  [...list.filter((o) => !done(o))].concat(P.showDone ? list.filter(done) : []);
const objList = (list: Objective[]) => `<div class="sp-list">${sorted(list).map(objRow).join('')}</div>`;
const statsHtml = (whole: boolean) =>
  `<div class="sp-stats">${STATS(whole ? 3 : 1)
    .map(
      (s) =>
        `<section><h4><img src="${emojiUrl(s.icon)}" alt="">${s.name}</h4>${s.rows.map(([k, v]) => `<p><span>${k}</span><b>${typeof v === 'number' ? n(v) : v}</b></p>`).join('')}</section>`,
    )
    .join('')}</div>`;
const seg = (names: string[], on: number) =>
  `<div class="sp-seg">${names.map((x, i) => `<button data-i="${i}" class="${i === on ? 'on' : ''}">${x}</button>`).join('')}</div>`;
const timeLeft = (c: Challenge) => Math.max(0, Math.ceil(c.time - c.t));
const chalProgress = (c: Challenge) => (c.want > 1 ? `${c.got}/${c.want}` : `${timeLeft(c)} s`);

// ---------- variant pieces
const A = {
  score: (s: number) => `<span>⭐</span><span>${n(s)}</span>`,
  chip: (c: Challenge) =>
    `<img src="${c.icon}" alt=""><span>${chalProgress(c)}</span><i><b style="width:${Math.round((1 - c.t / c.time) * 100)}%"></b></i>`,
  officeTabs: (on: number) => seg(['Upgrades', 'Objectives', 'Stats'], on),
  cardScore: (s: number) => `<span class="sp-card-score">⭐ ${n(s)}</span>`,
};
const B = {
  trophy: (s: number) => `🏆<span class="sp-b-badge">⭐ ${n(s)}</span>`,
  ring: (c: Challenge) =>
    `<div class="ring" style="--p:${(1 - c.t / c.time).toFixed(3)};--c:${c.time - c.t < 10 ? 'var(--angry)' : 'var(--money)'}"><i>${chalProgress(c)}</i></div><small><img src="${c.icon}" alt="" style="width:16px;height:16px;vertical-align:-3px"> ${c.short}</small>`,
  tile: (o: Objective) =>
    `<div class="sp-b-tile ${done(o) ? 'done' : ''}"><div class="ring" style="--p:${pct(o).toFixed(3)}"><img src="${o.icon}" alt=""></div>${o.label}<b>${done(o) ? '✓ +100' : `${n(o.got)}/${n(o.want)}`}</b></div>`,
  logbook: (mapName: string, score: number, total: number, objs: Objective[], tab: number) =>
    `<div class="panel"><div class="sp-b-head"><h2>📖 ${mapName}</h2><span class="big">⭐ ${n(score)}</span></div>
     <p style="margin:0;font-size:14px">Game total 🏆 ${n(total)} · ${objs.filter(done).length}/${objs.length} Objectives</p>
     ${seg(['Objectives', 'This Map', 'Whole game'], tab)}
     ${tab === 0 ? `<div class="sp-b-tiles">${sorted(objs).map(B.tile).join('')}</div>` : statsHtml(tab === 2)}
     <button class="btn back sp-close">Close</button></div>`,
};
const C = {
  tracker: (c: Challenge | null, objs: Objective[], score: number, rows: number) => {
    const pinned = objs
      .filter((o) => !done(o))
      .sort((x, y) => pct(y) - pct(x))
      .slice(0, rows);
    const chal = c
      ? `<div class="sp-row chal"><img src="${c.icon}" alt=""><div class="sp-txt"><span>⏱ ${c.short}</span><div class="sp-bar"><b style="width:${Math.round((1 - c.t / c.time) * 100)}%"></b></div></div><span class="sp-n">${chalProgress(c)}</span></div>`
      : '';
    return `${chal}${pinned.map(objRow).join('')}<div class="sp-c-foot"><span>⭐ ${n(score)}</span><span>${objs.filter(done).length}/${objs.length} ▾</span></div>`;
  },
  progress: (mapName: string, score: number, objs: Objective[], tab: number) =>
    `<div class="panel"><h2>${mapName} · ⭐ ${n(score)}</h2>${seg(['Objectives', 'This Map', 'Whole game'], tab)}
     ${tab === 0 ? objList(objs) : statsHtml(tab === 2)}<button class="btn back sp-close">Back</button></div>`,
};

export function openScorePrototype(): void {
  const app = (window as unknown as { app: AppGuts }).app;
  const url = new URL(location.href);
  let variant = (url.searchParams.get('score') ?? 'A').toUpperCase() as Variant;
  if (!NAMES[variant]) variant = 'A';
  document.head.append(el('style', '', CSS));

  // mock state, per Map
  const scores: Record<string, number> = {};
  const objs: Record<string, Objective[]> = {};
  let chal: Challenge | null = null;
  let chalIdx = 0;
  let mapId = '';
  const mapScore = () => scores[mapId] ?? 0;
  const total = () =>
    app.ui.maps.reduce((s, m, i) => s + (scores[m.map.id] ?? (m.visited ? [1240, 860, 420, 0][i] : 0)), 0);
  const scoreOf = (id: string, i: number, visited: boolean) => scores[id] ?? (visited ? [1240, 860, 420, 0][i] : 0);
  const myObjs = () => (objs[mapId] ??= objectivesFor(app.game?.world ?? null));
  const world = () => app.game?.world ?? null;

  const hud = () => document.querySelector('.hud-ui') as HTMLElement | null;
  const playing = () => app.ui.screen === 'game';

  const toast = (title: string, line: string, bad = false) => {
    const h = hud();
    if (!h) return;
    const t = el('div', `sp sp-toast pill ${bad ? 'bad' : ''}`, `<b>${title}</b><span>${line}</span>`);
    t.style.setProperty('--ms', `${P.toastMs}ms`);
    h.append(t);
    setTimeout(() => t.remove(), P.toastMs);
  };
  const bump = (e: Element | null | undefined) => {
    if (!e) return;
    e.classList.remove('bump2');
    void (e as HTMLElement).offsetWidth;
    e.classList.add('bump2');
  };

  // ---------- live HUD pieces
  let built: Variant | '' = '';
  const live: HTMLElement[] = [];
  let aScore: HTMLElement | null = null;
  let aChip: HTMLElement | null = null;
  let bTrophy: HTMLElement | null = null;
  let bRing: HTMLElement | null = null;
  let cTracker: HTMLElement | null = null;
  let modal: HTMLElement | null = null;
  let modalTab = 0;
  let officeTab = 0;
  let drawn = '';

  const clear = () => {
    live.splice(0).forEach((e) => e.remove());
    aScore = aChip = bTrophy = bRing = cTracker = null;
    document.querySelectorAll('.sp-inj').forEach((e) => e.remove());
    document.querySelector('.office')?.classList.remove('sp-hide');
    closeModal();
    built = '';
    drawn = '';
  };
  const stop = (e: Element) => e.addEventListener('pointerdown', (ev) => ev.stopPropagation());

  const build = () => {
    const h = hud();
    const top = h?.querySelector('.hud-top');
    if (!h || !top) return;
    clear();
    built = variant;
    if (variant === 'A') {
      aScore = el('div', 'sp pill sp-a-score');
      top.append(aScore);
      live.push(aScore);
    } else if (variant === 'B') {
      bTrophy = el('button', 'sp round sp-b-trophy sp-tap');
      stop(bTrophy);
      bTrophy.onclick = () => openLogbook(0);
      top.insertBefore(bTrophy, top.querySelector('.gear'));
      live.push(bTrophy);
    } else {
      cTracker = el('div', 'sp sp-c-tracker');
      stop(cTracker);
      cTracker.onclick = () => openProgress(0);
      h.append(cTracker);
      live.push(cTracker);
    }
  };

  const closeModal = () => {
    modal?.remove();
    modal = null;
  };
  const showModal = (html: () => string) => {
    closeModal();
    modal = el('div', 'sp sp-modal');
    stop(modal);
    const draw = () => {
      if (!modal) return;
      modal.innerHTML = html();
      modal.querySelectorAll<HTMLButtonElement>('.sp-seg button').forEach(
        (b) =>
          (b.onclick = () => {
            modalTab = Number(b.dataset.i);
            draw();
          }),
      );
      (modal.querySelector('.sp-close') as HTMLElement).onclick = closeModal;
    };
    modal.onclick = (e) => e.target === modal && closeModal();
    draw();
    document.body.append(modal);
  };
  const mapName = () => world()?.map.name ?? app.ui.maps.find((m) => m.map.id === mapId)?.map.name ?? 'Map';
  const openLogbook = (tab: number) => {
    modalTab = tab;
    showModal(() => B.logbook(mapName(), mapScore(), total(), myObjs(), modalTab));
  };
  const openProgress = (tab: number) => {
    modalTab = tab;
    showModal(() => C.progress(mapName(), mapScore(), myObjs(), modalTab));
  };

  // A: Office tabs. Preact owns `.office`; the tabs and pane are re-added whenever it rebuilds.
  const officeInject = () => {
    const off = document.querySelector('.office');
    if (!off) {
      officeTab = 0;
      return;
    }
    if (!off.querySelector('.sp-a-tabs')) {
      const tabs = el('div', 'sp sp-inj sp-a-tabs');
      tabs.innerHTML = A.officeTabs(officeTab);
      tabs.querySelectorAll<HTMLButtonElement>('button').forEach(
        (b) =>
          (b.onclick = () => {
            officeTab = Number(b.dataset.i);
            tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
            paneKey = '';
          }),
      );
      off.insertBefore(tabs, off.querySelector('.office-scroll'));
    }
    let pane = off.querySelector<HTMLElement>('.sp-pane');
    if (!pane) {
      pane = el('div', 'sp sp-inj sp-pane');
      off.append(pane);
      paneKey = '';
    }
    (off.querySelector('.office-scroll') as HTMLElement).style.display = officeTab ? 'none' : '';
    pane.style.display = officeTab ? '' : 'none';
    const key = `${officeTab}|${JSON.stringify(myObjs())}|${statsTab}`;
    if (officeTab && key !== paneKey) {
      paneKey = key;
      pane.innerHTML =
        officeTab === 1 ? objList(myObjs()) : `${seg(['This Map', 'Whole game'], statsTab)}${statsHtml(statsTab === 1)}`;
      pane.querySelectorAll<HTMLButtonElement>('.sp-seg button').forEach(
        (b) => (b.onclick = () => (statsTab = Number(b.dataset.i))),
      );
    }
  };
  let paneKey = '';
  let statsTab = 0;

  // C: a Progress button in the pause menu
  const pauseInject = () => {
    const menu = document.querySelector('.modal .menu');
    if (!menu || menu.querySelector('.sp-inj')) return;
    const b = el('button', 'btn big sp-inj', '📋 Progress');
    b.onclick = () => openProgress(0);
    menu.insertBefore(b, menu.children[1] ?? null);
  };

  // title screen: per-card Score and the game's total
  const titleInject = () => {
    const title = document.querySelector('.title');
    if (!title) return;
    const cards = title.querySelectorAll<HTMLElement>('.shelf-card');
    cards.forEach((c, i) => {
      const m = app.ui.maps[i];
      if (!m || c.querySelector('.sp-inj')) return;
      const s = scoreOf(m.map.id, i, m.visited);
      if (!m.visited) return;
      if (variant === 'A') c.append(el('span', 'sp-inj', A.cardScore(s)));
      if (variant === 'B') {
        c.style.position = 'absolute';
        c.append(el('span', 'sp-inj sp-ribbon', `⭐ ${n(s)}`));
      }
      if (variant === 'C') {
        const list = objs[m.map.id] ?? objectivesFor(null);
        c.append(el('span', 'sp-inj sp-c-objs', `⭐ ${n(s)} · ${list.filter(done).length}/${list.length} Objectives`));
      }
    });
    if (title.querySelector('.sp-inj-total')) return;
    const logo = title.querySelector('.logo, svg, h1');
    if (variant === 'A') title.append(el('div', 'sp sp-inj sp-inj-total pill sp-title-total', `⭐ ${n(total())}`));
    if (variant === 'B') {
      const p = el('div', 'sp sp-inj sp-inj-total pill sp-b-plaque', `🏆 ${n(total())}`);
      logo?.after(p);
      const corner = title.querySelector('.title-corner');
      const tb = el('button', 'round sp-inj', '🏆');
      tb.onclick = () => {
        mapId = mapId || app.save.currentMap;
        openLogbook(2);
      };
      corner?.prepend(tb);
    }
    if (variant === 'C') {
      const t = el('div', 'sp sp-inj sp-inj-total sp-c-total', `⭐ ${n(total())} total`);
      logo?.after(t);
    }
  };

  // ---------- demo drivers
  const startChallenge = () => {
    const list = challengesFor(world());
    chal = { ...list[chalIdx++ % list.length] };
    if (variant === 'A') {
      const h = hud();
      h?.querySelector('.event-banner')?.remove();
      const ban = el('div', 'event-banner pill sp', `<img src="${chal.icon}" alt=""><div><b>Challenge!</b><span>${chal.label}</span></div>`);
      h?.append(ban);
      setTimeout(() => {
        ban.classList.add('out');
        setTimeout(() => ban.remove(), 400);
      }, 2600);
    }
    if (variant === 'B') {
      const s = el('div', 'sp sp-b-stamp', 'CHALLENGE!');
      hud()?.append(s);
      setTimeout(() => s.remove(), 1200);
    }
    if (variant === 'C' && cTracker) bump(cTracker);
  };
  const endChallenge = (won: boolean) => {
    if (!chal) return;
    const c = chal;
    if (won) {
      scores[mapId] = mapScore() + 50;
      if (variant === 'C') floatPlus('+50');
      toast('Challenge won!', `${c.short} · ⭐ +50 · ${formatMoney(c.bonus)}`);
    } else if (variant !== 'C') toast('Time up', c.short, true);
    if (aChip) aChip.classList.toggle('win', won);
    setTimeout(
      () => {
        aChip?.remove();
        aChip = null;
      },
      won ? 600 : 0,
    );
    chal = null;
    bump(aScore ?? bTrophy);
  };
  const stepChallenge = () => {
    if (!chal) return;
    chal.got++;
    if (chal.got >= chal.want) endChallenge(true);
  };
  const floatPlus = (txt: string) => {
    const foot = cTracker?.querySelector('.sp-c-foot');
    const h = hud();
    if (!foot || !h) return;
    const r = foot.getBoundingClientRect();
    const hr = h.getBoundingClientRect();
    const s = h.getBoundingClientRect().width / h.offsetWidth || 1;
    const f = el('div', 'sp-c-float', txt);
    f.style.left = `${(r.left - hr.left) / s + 10}px`;
    f.style.top = `${(r.top - hr.top) / s - 10}px`;
    h.append(f);
    setTimeout(() => f.remove(), 1000);
  };
  const finishObjective = () => {
    const list = myObjs();
    const o = list.filter((x) => !done(x)).sort((x, y) => pct(y) - pct(x))[0];
    if (!o) return;
    const finish = () => {
      o.got = o.want;
      scores[mapId] = mapScore() + 100;
      drawn = '';
    };
    if (variant === 'A') {
      finish();
      toast('⭐ Objective done!', `${o.label} · +100`);
      bump(aScore);
    } else if (variant === 'B') {
      const h = hud();
      const f = el('div', 'sp pill sp-b-fly', `<img src="${o.icon}" alt=""><b>Objective done!</b><span>${o.label}</span><b>⭐ +100</b>`);
      h?.append(f);
      setTimeout(() => {
        const t = bTrophy?.getBoundingClientRect();
        const hr = h?.getBoundingClientRect();
        if (t && hr && h) {
          const s = hr.width / h.offsetWidth || 1;
          f.style.left = `${(t.left - hr.left + t.width / 2) / s}px`;
          f.style.top = `${(t.top - hr.top) / s}px`;
          f.style.transform = 'translate(-50%,0) scale(.1)';
        }
        setTimeout(() => {
          f.remove();
          finish();
          bump(bTrophy);
        }, 600);
      }, 1300);
    } else {
      // the row fills gold in the tracker, floats +100, then the next Objective slides in
      o.got = o.want - 0.0001;
      drawn = '';
      draw();
      const rows = cTracker?.querySelectorAll('.sp-row:not(.chal)');
      const row = [...(rows ?? [])].find((r) => r.textContent?.includes(o.label));
      row?.classList.add('gold');
      floatPlus('+100');
      setTimeout(() => row?.classList.add('out'), 700);
      setTimeout(finish, 1000);
    }
  };

  // ---------- frame
  const draw = () => {
    const c = chal;
    if (variant === 'A' && aScore) {
      aScore.style.setProperty('--ss', String(P.scoreScale));
      const key = `${mapScore()}`;
      if (key !== drawn) aScore.innerHTML = A.score(mapScore());
      drawn = key;
      const cards = hud()?.querySelector('.event-cards');
      if (c && cards) {
        if (!aChip || !aChip.isConnected) {
          aChip = el('div', 'event-card pill sp sp-a-chip');
          cards.append(aChip);
        }
        aChip.innerHTML = A.chip(c);
      }
    }
    if (variant === 'B' && bTrophy) {
      bTrophy.style.setProperty('--ss', String(P.scoreScale));
      const key = `${mapScore()}`;
      if (key !== drawn) bTrophy.innerHTML = B.trophy(mapScore());
      drawn = key;
      if (c) {
        if (!bRing) {
          bRing = el('div', 'sp sp-b-ring');
          hud()?.append(bRing);
          live.push(bRing);
        }
        bRing.style.setProperty('--rs', `${P.ringSize}px`);
        bRing.innerHTML = B.ring(c);
      } else if (bRing) {
        bRing.remove();
        bRing = null;
      }
    }
    if (variant === 'C' && cTracker) {
      cTracker.className = `sp sp-c-tracker ${P.trackerSide}`;
      cTracker.style.setProperty('--ts', String(P.trackerScale));
      cTracker.style.display = document.querySelector('.office') ? 'none' : '';
      const key = `${JSON.stringify(c)}|${JSON.stringify(myObjs())}|${mapScore()}|${P.trackerRows}`;
      if (key !== drawn) cTracker.innerHTML = C.tracker(c, myObjs(), mapScore(), P.trackerRows);
      drawn = key;
    }
  };

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    titleInject();
    if (!playing()) {
      if (built) clear();
      return;
    }
    const w = world();
    if (w && w.map.id !== mapId) {
      mapId = w.map.id;
      scores[mapId] ??= scoreOf(mapId, Math.max(0, app.ui.maps.findIndex((m) => m.map.id === mapId)), true);
      chal = null;
    }
    if (built !== variant || !live[0]?.isConnected) build();
    if (chal && !app.ui.overlay) {
      chal.t += dt * P.clock;
      if (chal.t >= chal.time) endChallenge(false);
    }
    if (variant === 'A') officeInject();
    if (variant === 'C') pauseInject();
    draw();
  };
  requestAnimationFrame(frame);

  // ---------- gallery: every variant's pieces at once
  let gal: HTMLElement | null = null;
  const gallery = () => {
    if (gal) {
      gal.remove();
      gal = null;
      return;
    }
    const w = world();
    const os = objectivesFor(w);
    const ch = { ...challengesFor(w)[0], got: 3, t: 22 };
    const fresh = os[1];
    const card = (extra: string) =>
      `<div class="shelf-card on"><div class="shelf-art">🏪</div><b>Corner Shop</b><span class="completion small"><i style="width:42%"></i></span><small>42%</small>${extra}</div>`;
    const hudTop = (inner: string) =>
      `<div class="hud-top"><div class="completion"><i style="width:42%"></i></div><div class="money pill">$1,234</div>${inner}<button class="gear round">⚙</button></div>`;
    const col = (v: Variant, parts: [string, string][]) =>
      `<div class="col sp"><h2>${v} · ${NAMES[v]}<button class="btn buy" data-pick="${v}">Pick</button></h2>${parts
        .map(([h, body]) => `<div><h5>${h}</h5><div class="frame">${body}</div></div>`)
        .join('')}</div>`;
    const a = col('A', [
      ['HUD: Score under the bar', `${hudTop('')}<div class="pill sp-a-score" style="--ss:1;position:static;display:inline-flex;margin-top:8px">${A.score(1240)}</div>`],
      ['Challenge: banner, then a card', `<div class="event-banner pill" style="position:relative;left:0;top:0;animation:none;transform:none;display:inline-flex"><img src="${ch.icon}"><div><b>Challenge!</b><span>${ch.label}</span></div></div><div class="event-card pill sp-a-chip" style="display:inline-flex;margin-top:8px">${A.chip(ch)}</div>`],
      ['Objective done', `<div class="sp-toast pill"><b>⭐ Objective done!</b><span>${fresh.label} · +100</span></div>`],
      ['Office: Objectives tab', `<div class="panel">${A.officeTabs(1)}${objList(os)}</div>`],
      ['Office: Stats tab', `<div class="panel">${A.officeTabs(2)}${seg(['This Map', 'Whole game'], 0)}${statsHtml(false)}</div>`],
      ['Title: card + total pill (top-left)', `<div class="pill sp-title-total" style="position:static;display:inline-flex">⭐ 2,520</div>${card(A.cardScore(1240))}`],
    ]);
    const b = col('B', [
      ['HUD: Trophy by the gear', `${hudTop(`<span class="round sp-b-trophy" style="--ss:1;position:relative;right:auto">${B.trophy(1240)}</span>`)}`],
      ['Challenge: stamp, then a ring timer', `<div class="sp-b-stamp">CHALLENGE!</div><div class="sp-b-ring" style="--rs:64px">${B.ring(ch)}</div>`],
      ['Objective done: flies into the trophy', `<div class="sp-b-fly pill" style="position:relative;left:0;top:0;transform:none;display:inline-flex"><img src="${fresh.icon}"><b>Objective done!</b><span>${fresh.label}</span><b>⭐ +100</b></div>`],
      ['Logbook (trophy): Objectives', B.logbook('Corner Shop', 1240, 2520, os, 0)],
      ['Logbook: Whole game Stats', B.logbook('Corner Shop', 1240, 2520, os, 2)],
      ['Title: plaque + ribbon + 🏆 button', `<div class="pill sp-b-plaque" style="display:inline-flex">🏆 2,520</div>${card('<span class="sp-ribbon">⭐ 1,240</span>')}`],
    ]);
    const c = col('C', [
      ['HUD: tracker (Challenge + 2 nearest)', `<div class="sp-c-tracker right" style="--ts:1">${C.tracker(ch, os, 1240, 2)}</div>`],
      ['Challenge: top row of the tracker', `<div class="sp-c-tracker right" style="--ts:1">${C.tracker(ch, [], 1240, 0)}</div>`],
      ['Objective done: row goes gold, +100 floats', `<div class="sp-c-tracker right" style="--ts:1"><div class="sp-row gold">${objRow({ ...fresh }).replace(/^<div class="sp-row[^"]*">/, '').replace(/<\/div>$/, '')}</div><div class="sp-c-foot"><span>⭐ 1,340</span><span style="color:var(--money)">+100</span></div></div>`],
      ['Pause menu → 📋 Progress', C.progress('Corner Shop', 1240, os, 0)],
      ['Progress: Whole game Stats', C.progress('Corner Shop', 1240, os, 2)],
      ['Title: total under the logo + card', `<div class="sp-c-total">⭐ 2,520 total</div>${card(`<span class="sp-c-objs">⭐ 1,240 · 2/10 Objectives</span>`)}`],
    ]);
    gal = el('div', '', `<div class="cols">${a}${b}${c}</div>`);
    gal.id = 'sp-gal';
    stop(gal);
    gal.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(
      (btn) =>
        (btn.onclick = () => {
          select(btn.dataset.pick as Variant);
          gallery();
        }),
    );
    document.body.append(gal);
  };

  // ---------- switcher bar, panel, dump
  const bar = el('div');
  bar.id = 'sp-bar';
  stop(bar);
  const label = el('span');
  const select = (v: Variant) => {
    variant = v;
    url.searchParams.set('score', v);
    history.replaceState(null, '', url);
    label.textContent = `${v} (${NAMES[v]})`;
    clear();
    document.querySelectorAll('.sp-inj, .sp-inj-total').forEach((e) => e.remove());
  };
  const cycle = (d: number) => select(VARIANTS[(VARIANTS.indexOf(variant) + d + VARIANTS.length) % VARIANTS.length]);
  const btn = (txt: string, fn: () => void) => {
    const b = el('button', '', txt);
    b.onclick = fn;
    return b;
  };
  const toOffice = () => {
    const w = world();
    const off = w?.stations.get('office');
    if (!w || !off) return;
    const [x, z] = boxCentre(off.box);
    const i = nearestFreeCell(w.nav.walker, x, z);
    if (i < 0) return;
    [w.player.x, w.player.z] = cellCentre(w.nav.walker, i);
  };
  const dump = () => {
    const text = `// score=${variant} — ${NAMES[variant]}\n${JSON.stringify(P, null, 2)}`;
    void navigator.clipboard?.writeText(text);
    prompt('Values (copied):', text);
  };
  bar.append(
    btn('◀', () => cycle(-1)),
    label,
    btn('▶', () => cycle(1)),
    btn('Challenge', () => (chal ? endChallenge(false) : startChallenge())),
    btn('+1', stepChallenge),
    btn('Objective', finishObjective),
    btn('Office', toOffice),
    btn('List', () => (variant === 'A' ? (toOffice(), (officeTab = 1)) : variant === 'B' ? openLogbook(0) : openProgress(0))),
    btn('Gallery', gallery),
    btn('Dump', dump),
  );
  document.body.append(bar);
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === '[') cycle(-1);
    if (e.key === ']') cycle(1);
  });

  void import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'PROTOTYPE · score UI' });
    gui.add(P, 'toastMs', 800, 5000, 100).name('toast ms');
    gui.add(P, 'clock', 0.5, 10, 0.5).name('Challenge clock ×');
    gui.add(P, 'scoreScale', 0.6, 1.6, 0.05).name('A/B Score size');
    gui.add(P, 'ringSize', 40, 110, 1).name('B ring px');
    gui.add(P, 'trackerRows', 0, 4, 1).name('C pinned rows');
    gui.add(P, 'trackerScale', 0.6, 1.4, 0.05).name('C tracker scale');
    gui.add(P, 'trackerSide', ['right', 'left']).name('C tracker side');
    gui.add(P, 'showDone').name('done ones in lists').onChange(() => (paneKey = drawn = ''));
    gui.close();
  });

  label.textContent = `${variant} (${NAMES[variant]})`;
  if (url.searchParams.has('gallery')) setTimeout(gallery, 500);
  // `&play` skips the title
  if (url.searchParams.has('play')) setTimeout(() => app.play(app.save.currentMap), 300);
}
