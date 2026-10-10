// PROTOTYPE — throwaway (prototype/title-picker). Three title screens with a Map picker and Settings, via ?variant=A|B|C.
import { useEffect, useState } from 'preact/hooks';
import GUI from 'lil-gui';
import type { UiActions, UiState } from './app';
import { Logo } from './logo';

interface ProtoMap {
  id: string;
  name: string;
  emoji: string;
  tint: string;
  twist: string;
}

const MAPS: ProtoMap[] = [
  { id: 'corner-shop', name: 'Corner Shop', emoji: '🍅', tint: 'var(--angry)', twist: 'Learn the ropes' },
  { id: 'juice-bar', name: 'Juice Bar', emoji: '🍊', tint: 'var(--role-goods)', twist: 'Deliveries galore' },
  { id: 'dairy-farm', name: 'Dairy Farm', emoji: '🐄', tint: 'var(--money)', twist: 'The Inspector drops by' },
  { id: 'pizza-place', name: 'Pizza Place', emoji: '🍕', tint: 'var(--role-machines)', twist: 'Thieves downtown' },
];

const P = {
  variant: new URLSearchParams(location.search).get('variant') ?? 'A',
  unlocked: 2,
  lastPlayed: 'juice-bar',
  teaseLocked: 'next only',
  corner: 100,
  juice: 42,
  dairy: 0,
  pizza: 0,
  dump: '',
};
const pct = (i: number) => [P.corner, P.juice, P.dairy, P.pizza][i];

let gui: GUI | null = null;
function useProtoPanel(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (gui) return;
    gui = new GUI({ title: 'Title prototype' });
    if (innerWidth < 700) gui.close();
    const bump = () => setTick((t) => t + 1);
    gui
      .add(P, 'variant', { 'A — Play + Maps': 'A', 'B — Map shelf': 'B', 'C — Play opens picker': 'C' })
      .onChange((v: string) => {
        const u = new URL(location.href);
        u.searchParams.set('variant', v);
        history.replaceState(null, '', u);
        bump();
      });
    gui.add(P, 'unlocked', 1, 4, 1).name('Maps unlocked').onChange(bump);
    gui.add(P, 'lastPlayed', Object.fromEntries(MAPS.map((m) => [m.name, m.id]))).name('Last played').onChange(bump);
    gui.add(P, 'teaseLocked', ['next only', 'all four', 'none']).name('Locked Maps show').onChange(bump);
    const c = gui.addFolder('Completion %');
    for (const k of ['corner', 'juice', 'dairy', 'pizza'] as const) c.add(P, k, 0, 100, 1).onChange(bump);
    gui.add({ show: () => ((P.dump = JSON.stringify({ ...P, dump: undefined }, null, 1)), bump()) }, 'show').name('Show values');
    gui.add({ hide: () => ((P.dump = ''), bump()) }, 'hide').name('Hide values');
  }, []);
  return tick;
}

function locked(i: number): 'open' | 'next' | 'hidden' {
  if (i < P.unlocked) return 'open';
  if (P.teaseLocked === 'all four') return 'next';
  if (P.teaseLocked === 'next only' && i === P.unlocked) return 'next';
  return 'hidden';
}

function Bar({ i }: { i: number }) {
  return (
    <span class="completion small">
      <i style={{ width: `${pct(i)}%` }} />
    </span>
  );
}

function Gear({ a }: { a: UiActions }) {
  return (
    <button class="round proto-gear" aria-label="Settings" onClick={() => (a.click(), a.open('settings'))}>
      ⚙
    </button>
  );
}

function go(a: UiActions, m: ProtoMap, setToast: (t: string) => void) {
  P.lastPlayed = m.id;
  gui?.controllersRecursive().forEach((c) => c.updateDisplay());
  if (m.id === 'corner-shop') a.play();
  else {
    setToast(`Would open ${m.name}`);
    setTimeout(() => setToast(''), 1500);
  }
}

const lockHint = (i: number) => `Buy the Exit Pad in ${MAPS[i - 1].name}`;

// A: Play continues the last Map; Maps and Settings buttons under it; Maps opens a card grid.
function VariantA({ a, toast }: Props) {
  const [open, setOpen] = useState(false);
  const last = MAPS.findIndex((m) => m.id === P.lastPlayed);
  return (
    <div class="title">
      <Logo />
      <button class="btn play buy proto-play" onClick={() => go(a, MAPS[last], toast)}>
        ▶ Play
        <small>
          {MAPS[last].emoji} {MAPS[last].name} · {pct(last)}%
        </small>
      </button>
      <div class="proto-row">
        <button class="btn" onClick={() => (a.click(), setOpen(true))}>
          🗺 Maps
        </button>
        <button class="btn" onClick={() => (a.click(), a.open('settings'))}>
          ⚙ Settings
        </button>
      </div>
      {open && (
        <div class="modal">
          <div class="panel wide">
            <h2>Maps</h2>
            <div class="maps">
              {MAPS.map((m, i) => {
                const l = locked(i);
                if (l === 'hidden') return null;
                return l === 'open' ? (
                  <button key={m.id} class="btn map-card" onClick={() => go(a, m, toast)}>
                    <b>
                      {m.emoji} {m.name}
                    </b>
                    <small>{m.twist}</small>
                    <Bar i={i} />
                    <small>{pct(i)}%</small>
                  </button>
                ) : (
                  <div key={m.id} class="map-card locked">
                    <b>🔒 {m.name}</b>
                    <small>{lockHint(i)}</small>
                  </div>
                );
              })}
            </div>
            <button class="btn back" onClick={() => setOpen(false)}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// B: the Maps are the title: a swipeable shelf of big cards, Play under the one in front, gear in the corner.
function VariantB({ a, toast }: Props) {
  const shown = MAPS.map((m, i) => ({ m, i, l: locked(i) })).filter((x) => x.l !== 'hidden');
  const [at, setAt] = useState(Math.max(0, shown.findIndex((x) => x.m.id === P.lastPlayed)));
  const cur = shown[Math.min(at, shown.length - 1)];
  return (
    <div class="title proto-b">
      <Gear a={a} />
      <div class="proto-logo-small">
        <Logo />
      </div>
      <div class="proto-shelf">
        <button class="round" disabled={at === 0} onClick={() => setAt(at - 1)}>
          ◀
        </button>
        <div class="proto-cards">
          {shown.map(({ m, i, l }, k) => (
            <div
              key={m.id}
              class={`proto-card ${k === at ? 'on' : ''} ${l !== 'open' ? 'locked' : ''}`}
              style={{ '--tint': m.tint } as Record<string, string>}
              onClick={() => setAt(k)}
            >
              <div class="proto-art">{l === 'open' ? m.emoji : '🔒'}</div>
              <b>{m.name}</b>
              {l === 'open' ? (
                <>
                  <small>{m.twist}</small>
                  <Bar i={i} />
                  <small>{pct(i)}%</small>
                </>
              ) : (
                <small>{lockHint(i)}</small>
              )}
            </div>
          ))}
        </div>
        <button class="round" disabled={at >= shown.length - 1} onClick={() => setAt(at + 1)}>
          ▶
        </button>
      </div>
      <button class="btn play buy" disabled={cur.l !== 'open'} onClick={() => go(a, cur.m, toast)}>
        ▶ Play
      </button>
    </div>
  );
}

// C: the title stays bare; Play goes straight in with one Map, else opens a full-height picker list.
function VariantC({ a, toast }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div class="title">
      <Logo />
      <button
        class="btn play buy"
        onClick={() => (P.unlocked === 1 ? go(a, MAPS[0], toast) : (a.click(), setOpen(true)))}
      >
        ▶ Play
      </button>
      <div class="proto-row">
        <button class="btn" onClick={() => (a.click(), a.open('settings'))}>
          ⚙ Settings
        </button>
        <button class="btn" onClick={() => (a.click(), a.open('credits'))}>
          ★ Credits
        </button>
      </div>
      {open && (
        <div class="proto-picker">
          <h2>Pick a Map</h2>
          {MAPS.map((m, i) => {
            const l = locked(i);
            if (l === 'hidden') return null;
            return (
              <button
                key={m.id}
                class={`btn proto-rowcard ${l !== 'open' ? 'locked' : ''}`}
                disabled={l !== 'open'}
                style={{ '--tint': m.tint } as Record<string, string>}
                onClick={() => go(a, m, toast)}
              >
                <span class="proto-tile">{l === 'open' ? m.emoji : '🔒'}</span>
                <span class="proto-text">
                  <b>
                    {i + 1}. {m.name}
                    {m.id === P.lastPlayed && l === 'open' && <em> last played</em>}
                  </b>
                  <small>{l === 'open' ? m.twist : lockHint(i)}</small>
                  {l === 'open' && <Bar i={i} />}
                </span>
                {l === 'open' && <span class="proto-pct">{pct(i)}%</span>}
              </button>
            );
          })}
          <button class="btn back" onClick={() => setOpen(false)}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  s: UiState;
  a: UiActions;
  toast: (t: string) => void;
}

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
const NAMES = { A: 'Play + Maps', B: 'Map shelf', C: 'Play opens picker' } as const;
type Key = keyof typeof VARIANTS;

export function TitlePrototype({ s, a }: { s: UiState; a: UiActions }) {
  useProtoPanel();
  const [toast, setToast] = useState('');
  const keys = Object.keys(VARIANTS) as Key[];
  const v = (keys.includes(P.variant as Key) ? P.variant : 'A') as Key;
  const V = VARIANTS[v];
  const step = (d: number) => {
    P.variant = keys[(keys.indexOf(v) + d + keys.length) % keys.length];
    const u = new URL(location.href);
    u.searchParams.set('variant', P.variant);
    history.replaceState(null, '', u);
    gui?.controllersRecursive().forEach((c) => c.updateDisplay());
    setToast(' ');
    setTimeout(() => setToast(''), 0);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  });
  return (
    <>
      <V key={v} s={s} a={a} toast={setToast} />
      {toast.trim() && <div class="proto-toast">{toast}</div>}
      {P.dump && <pre class="proto-dump">{P.dump}</pre>}
      <div class="proto-switch">
        <button onClick={() => step(-1)}>←</button>
        <span>
          {v} — {NAMES[v]}
        </span>
        <button onClick={() => step(1)}>→</button>
      </div>
    </>
  );
}
