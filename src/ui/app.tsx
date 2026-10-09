// Preact panels: title, Office, pause, Maps, Settings and the one-off cards.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { STOCKER_ROLES, type StockerRole, type World } from '../sim/world';
import type { MapDef } from '../sim/map';
import type { Settings } from '../sim/save';
import { canBuyUpgrade, nextLevelCost, upgradeVisible } from '../sim/economy';
import { formatMoney } from '../format';
import { FEEL } from '../feel';
import { Logo } from './logo';
import { CREDITS } from '../../catalog/credits';

export type Overlay = 'pause' | 'settings' | 'maps' | 'credits' | 'controls' | 'paste' | 'home-tip';

export interface UiState {
  screen: 'title' | 'game';
  loading: number;
  overlay: Overlay | null;
  office: boolean;
  card: null | 'other-tab' | 'ios' | { message: string };
  storageFailed: boolean;
  wipe: boolean;
  touch: boolean;
  ios: boolean;
  maps: { map: MapDef; completion: number; visited: boolean }[];
  comingSoon: number;
  settings: Settings;
  /** Zoom in effect: the saved one or the device default (m across the short side). */
  zoom: number;
}

export interface UiActions {
  play: () => void;
  close: () => void;
  open: (o: Overlay) => void;
  closeOffice: () => void;
  buyUpgrade: (id: string) => void;
  assign: (stocker: string, role: StockerRole) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  fullscreen: () => void;
  copySave: () => Promise<boolean>;
  pasteSave: (code: string) => string | null;
  resetProgress: () => void;
  pickMap: (id: string) => void;
  dismissCard: () => void;
  icon: (name: string) => string;
  click: () => void;
}

const FAMILY_ORDER = ['player', 'station', 'staff'] as const;
const FAMILY_NAME = { player: 'Player', station: 'Station', staff: 'Staff' };
const ROLE_NAME: Record<StockerRole, string> = { auto: 'Auto', goods: 'Goods', machines: 'Machines' };

function upgradeIcon(world: World, target: string): string {
  if (target === 'player') return 'player';
  if (target === 'cashier' || target === 'stocker') return 'employee';
  return world.map.producers[target]?.model ?? target;
}

function Btn(props: {
  class?: string;
  onClick: () => void;
  disabled?: boolean;
  children: preact.ComponentChildren;
  actions: UiActions;
}) {
  return (
    <button
      class={`btn ${props.class ?? ''}`}
      disabled={props.disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => {
        props.actions.click();
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );
}

function Office({ world, actions, wide }: { world: World; actions: UiActions; wide: boolean }) {
  const ups = Object.entries(world.map.upgrades).filter(([id]) => upgradeVisible(world, id));
  return (
    <div class={`office ${wide ? 'side' : 'sheet'}`} onPointerDown={(e) => e.stopPropagation()}>
      <button class="x round" onClick={actions.closeOffice} aria-label="Close">
        ✕
      </button>
      <div class="office-scroll">
        {FAMILY_ORDER.map((family) => {
          const list = ups.filter(([, u]) => u.family === family);
          if (!list.length) return null;
          return (
            <section key={family}>
              <h3>{FAMILY_NAME[family]}</h3>
              <div class="cards">
                {list.map(([id, up]) => {
                  const lvl = world.levels[id] ?? 0;
                  const cost = nextLevelCost(world, id);
                  const can = canBuyUpgrade(world, id);
                  return (
                    <div class="upgrade" key={id}>
                      <img src={actions.icon(upgradeIcon(world, up.target))} alt="" />
                      <div class="up-text">
                        <b>{up.name}</b>
                        <span class="pips">
                          {up.levels.map((_, i) => (
                            <i key={i} class={i < lvl ? 'on' : ''} />
                          ))}
                        </span>
                      </div>
                      {cost === null ? (
                        <span class="maxed">MAX</span>
                      ) : (
                        <Btn
                          class={can ? 'buy' : 'buy off'}
                          actions={actions}
                          onClick={() => can && actions.buyUpgrade(id)}
                        >
                          {formatMoney(cost)}
                          {!can && <small>−{formatMoney(cost - world.money)}</small>}
                        </Btn>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {world.stockers.length > 0 && (
          <section>
            <h3>Stockers</h3>
            {world.stockers.map((s, i) => (
              <div class="assign" key={s.id}>
                <img src={actions.icon('employee')} alt="" />
                <b>#{i + 1}</b>
                <div class="chips">
                  {STOCKER_ROLES.map((role) => (
                    <Btn
                      key={role}
                      class={s.role === role ? `chip on role-${role}` : 'chip'}
                      actions={actions}
                      onClick={() => actions.assign(s.id, role)}
                    >
                      {ROLE_NAME[role]}
                    </Btn>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function HoldButton({ onDone, children }: { onDone: () => void; children: preact.ComponentChildren }) {
  const [held, setHeld] = useState(false);
  const timer = useRef<number>(0);
  const start = () => {
    setHeld(true);
    timer.current = window.setTimeout(() => {
      setHeld(false);
      onDone();
    }, 2000);
  };
  const stop = () => {
    setHeld(false);
    clearTimeout(timer.current);
  };
  return (
    <button
      class={`btn danger hold ${held ? 'held' : ''}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      <i />
      {children}
    </button>
  );
}

function Toggle(props: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  actions: UiActions;
  /** Shown instead of On / Off. */
  text?: string;
  disabled?: boolean;
}) {
  return (
    <Btn
      class={`toggle ${props.on ? 'on' : ''}`}
      actions={props.actions}
      disabled={props.disabled}
      onClick={() => props.set(!props.on)}
    >
      <span>{props.label}</span>
      <i>{props.text ?? (props.on ? 'On' : 'Off')}</i>
    </Btn>
  );
}

/** Zoom slider: + (closer) on the left, − (farther) on the right; the view behind zooms live. */
function ZoomRow({ s, a }: { s: UiState; a: UiActions }) {
  return (
    <label class="zoom-row">
      <span>Zoom</span>
      <b>+</b>
      <input
        type="range"
        min={FEEL.zoomMin}
        max={FEEL.zoomMax}
        step={FEEL.zoomSlider}
        value={s.zoom}
        onPointerDown={(e) => e.stopPropagation()}
        onInput={(e) => a.setSetting('zoom', Number((e.target as HTMLInputElement).value))}
      />
      <b>−</b>
    </label>
  );
}

function Settings({ s, a }: { s: UiState; a: UiActions }) {
  const [copied, setCopied] = useState('');
  return (
    <div class="panel">
      <h2>Settings</h2>
      <ZoomRow s={s} a={a} />
      <Toggle label="Music" on={s.settings.music} set={(v) => a.setSetting('music', v)} actions={a} />
      <Toggle label="Sounds" on={s.settings.sounds} set={(v) => a.setSetting('sounds', v)} actions={a} />
      {!s.touch && (
        <Toggle
          label="Manual grab (hold Space)"
          on={s.settings.manualGrab}
          set={(v) => a.setSetting('manualGrab', v)}
          actions={a}
        />
      )}
      <Toggle
        label="Frame rate"
        on={s.settings.frameRate === 60 && !s.settings.batterySaver}
        text={s.settings.batterySaver ? '30' : String(s.settings.frameRate)}
        disabled={s.settings.batterySaver}
        set={() => a.setSetting('frameRate', s.settings.frameRate === 60 ? 30 : 60)}
        actions={a}
      />
      <Toggle
        label="Battery saver"
        on={s.settings.batterySaver}
        set={(v) => a.setSetting('batterySaver', v)}
        actions={a}
      />
      <Btn actions={a} onClick={a.fullscreen}>
        Fullscreen
      </Btn>
      <div class="row">
        <Btn actions={a} onClick={() => a.open('controls')}>
          Controls
        </Btn>
        <Btn actions={a} onClick={() => a.open('credits')}>
          Credits
        </Btn>
      </div>
      <div class="row">
        <Btn actions={a} onClick={() => void a.copySave().then((ok) => setCopied(ok ? 'Copied!' : 'Copy failed'))}>
          {copied || 'Copy save code'}
        </Btn>
        <Btn actions={a} onClick={() => a.open('paste')}>
          Paste save code
        </Btn>
      </div>
      {s.ios && (
        <Btn actions={a} onClick={() => a.open('home-tip')}>
          Add to Home Screen
        </Btn>
      )}
      <HoldButton onDone={a.resetProgress}>Hold to reset progress</HoldButton>
      <Btn class="back" actions={a} onClick={() => a.open('pause')}>
        Back
      </Btn>
    </div>
  );
}

function Paste({ a }: { a: UiActions }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  return (
    <div class="panel">
      <h2>Paste save code</h2>
      <textarea
        value={code}
        onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)}
        placeholder="Paste here"
      />
      {error && <p class="error">{error}</p>}
      {confirm ? (
        <div class="row">
          <Btn
            class="danger"
            actions={a}
            onClick={() => {
              const err = a.pasteSave(code);
              if (err) {
                setError(err);
                setConfirm(false);
              }
            }}
          >
            Replace my progress
          </Btn>
          <Btn actions={a} onClick={() => setConfirm(false)}>
            Cancel
          </Btn>
        </div>
      ) : (
        <Btn actions={a} disabled={!code.trim()} onClick={() => setConfirm(true)}>
          Load
        </Btn>
      )}
      <Btn class="back" actions={a} onClick={() => a.open('settings')}>
        Back
      </Btn>
    </div>
  );
}

function Maps({ s, a }: { s: UiState; a: UiActions }) {
  return (
    <div class="panel wide">
      <h2>Maps</h2>
      <div class="maps">
        {s.maps.map((m) => (
          <Btn key={m.map.id} class="map-card" actions={a} onClick={() => a.pickMap(m.map.id)} disabled={!m.visited}>
            <b>{m.map.name}</b>
            <span class="completion small">
              <i style={{ width: `${Math.round(m.completion * 100)}%` }} />
            </span>
            <small>{Math.round(m.completion * 100)}%</small>
          </Btn>
        ))}
        {Array.from({ length: s.comingSoon }, (_, i) => (
          <div class="map-card locked" key={i}>
            <b>?</b>
            <small>coming soon</small>
          </div>
        ))}
      </div>
      <Btn class="back" actions={a} onClick={a.close}>
        Back
      </Btn>
    </div>
  );
}

function Controls({ a, touch }: { a: UiActions; touch: boolean }) {
  return (
    <div class="panel">
      <h2>Controls</h2>
      {touch ? (
        <p>Drag anywhere to walk. Walk near things to use them.</p>
      ) : (
        <ul class="controls">
          <li>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / arrows — walk
          </li>
          <li>Walk near things to use them</li>
          <li>
            <kbd>Space</kbd> — grab (Manual grab only)
          </li>
          <li>
            <kbd>Esc</kbd> — close / pause
          </li>
        </ul>
      )}
      <Btn class="back" actions={a} onClick={() => a.open('settings')}>
        Back
      </Btn>
    </div>
  );
}

function Credits({ a }: { a: UiActions }) {
  return (
    <div class="panel">
      <h2>Credits</h2>
      <div class="credits">
        <p>
          <b>Wobbly Mart</b> — made with Three.js, Preact, nipplejs and howler.js.
        </p>
        {CREDITS.map((c) => (
          <p key={c.what}>
            <b>{c.what}</b> — {c.author} ({c.license})
          </p>
        ))}
      </div>
      <Btn class="back" actions={a} onClick={() => a.open('settings')}>
        Back
      </Btn>
    </div>
  );
}

const SHARE_ICON = (
  <svg viewBox="0 0 24 24" class="share">
    <path d="M12 3v12M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" fill="none" />
    <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none" />
  </svg>
);

function HomeTip({ a }: { a: UiActions }) {
  return (
    <div class="panel">
      <h2>Play full screen</h2>
      <p>Tap {SHARE_ICON} then “Add to Home Screen”.</p>
      <Btn class="back" actions={a} onClick={a.close}>
        OK
      </Btn>
    </div>
  );
}

function Title({ s, a }: { s: UiState; a: UiActions }) {
  const ready = s.loading >= 1;
  return (
    <div class="title">
      <Logo />
      {ready ? (
        <Btn class="play buy" actions={a} onClick={a.play}>
          Play
        </Btn>
      ) : (
        <div class="loading">
          <i style={{ width: `${Math.round(s.loading * 100)}%` }} />
        </div>
      )}
      {s.storageFailed && <p class="note">Progress won't be saved in this browser.</p>}
    </div>
  );
}

function Card({ s, a }: { s: UiState; a: UiActions }) {
  if (!s.card) return null;
  if (s.card === 'other-tab')
    return (
      <div class="modal">
        <div class="panel">
          <h2>Playing in another tab</h2>
          <p>This tab is paused.</p>
        </div>
      </div>
    );
  if (s.card === 'ios')
    return (
      <div class="modal">
        <div class="panel">
          <h2>Play full screen</h2>
          <p>Tap {SHARE_ICON} then “Add to Home Screen”.</p>
          <Btn class="buy" actions={a} onClick={a.dismissCard}>
            OK
          </Btn>
        </div>
      </div>
    );
  return (
    <div class="modal">
      <div class="panel">
        <p>{s.card.message}</p>
        <Btn class="buy" actions={a} onClick={a.dismissCard}>
          OK
        </Btn>
      </div>
    </div>
  );
}

function Wipe({ on }: { on: boolean }) {
  return <div class={`wipe ${on ? 'closed' : ''}`} />;
}

function App({ s, a, world }: { s: UiState; a: UiActions; world: World | null }) {
  const [wide, setWide] = useState(innerWidth > innerHeight);
  useEffect(() => {
    const on = () => setWide(innerWidth > innerHeight);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  const overlay = s.overlay;
  return (
    <>
      {s.screen === 'title' && <Title s={s} a={a} />}
      {s.screen === 'game' && s.office && world && !overlay && <Office world={world} actions={a} wide={wide} />}
      {overlay && (
        <div class="modal" onPointerDown={(e) => e.stopPropagation()}>
          {overlay === 'pause' && (
            <div class="menu">
              <Btn class="big" actions={a} onClick={a.close}>
                ▶ Resume
              </Btn>
              <Btn class="big" actions={a} onClick={() => a.open('maps')}>
                Maps
              </Btn>
              <Btn class="big" actions={a} onClick={() => a.open('settings')}>
                Settings
              </Btn>
            </div>
          )}
          {overlay === 'settings' && <Settings s={s} a={a} />}
          {overlay === 'maps' && <Maps s={s} a={a} />}
          {overlay === 'credits' && <Credits a={a} />}
          {overlay === 'controls' && <Controls a={a} touch={s.touch} />}
          {overlay === 'paste' && <Paste a={a} />}
          {overlay === 'home-tip' && <HomeTip a={a} />}
        </div>
      )}
      <Card s={s} a={a} />
      <Wipe on={s.wipe} />
    </>
  );
}

export function renderUi(root: HTMLElement, s: UiState, a: UiActions, world: World | null): void {
  render(<App s={s} a={a} world={world} />, root);
}
