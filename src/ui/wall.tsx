// The Wall of Fame: tabs, the top three in Employee-of-the-Month frames, Around you, Everyone; and its row.
import { useRef } from 'preact/hooks';
import { RANK_CAP, type BoardKind, type BoardResponse, type Row } from '../../worker/api';
import { AVATAR_COLOURS } from '../palette';
import { dailyDate } from '../sim/daily';
import { Btn } from './btn';
import { Popup } from './popup';

export const colourOf = (name: string): string =>
  AVATAR_COLOURS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % AVATAR_COLOURS.length];

export const initials = (name: string): string =>
  name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const Avatar = ({ name }: { name: string }) => (
  <span class="wall-av" style={{ '--c': colourOf(name) }}>
    {initials(name)}
  </span>
);

/** A rank or Board total; the Worker counts up to RANK_CAP and sends anything past it as RANK_CAP + 1. */
export const countText = (n: number): string => (n > RANK_CAP ? `${RANK_CAP}+` : n.toLocaleString('en-US'));

export function WallRow(props: { rank: number; nickname: string; value: string; me?: boolean }) {
  return (
    <div class={`wall-row ${props.me ? 'me' : ''}`}>
      <i>{countText(props.rank)}</i>
      <Avatar name={props.nickname} />
      <b>{props.nickname}</b>
      <span>{props.value}</span>
    </div>
  );
}

/** No Device yet: the way onto the Wall. */
export function JoinCard(props: { title: string; line: string; a: { join: () => void; click: () => void } }) {
  return (
    <div class="wall-join">
      <span class="wall-av">?</span>
      <p>
        <b>{props.title}</b>
        {props.line}
      </p>
      <Btn class="buy" actions={props.a} onClick={props.a.join}>
        Pick a Nickname
      </Btn>
    </div>
  );
}

export type WallTab = 'today' | 'speed' | 'stars' | 'streaks';

/** `board`: null while loading, 'offline' when out of reach. */
export interface WallView {
  tab: WallTab;
  /** Speed and Stars: the Map picked with the chips. */
  map: string;
  maps: { id: string; name: string; playable: boolean }[];
  board: BoardResponse | 'offline' | null;
  hasDevice: boolean;
  /** Today: the day shown, stepped with ◀ / ▶ from day 1 up to `today`. */
  day: number;
  today: number;
}

export interface WallActions {
  tab: (tab: WallTab) => void;
  map: (id: string) => void;
  day: (day: number) => void;
  retry: () => void;
  close: () => void;
  join: () => void;
  play: (mapId: string) => void;
  playShift: () => void;
  click: () => void;
}

const TABS: WallTab[] = ['today', 'speed', 'stars', 'streaks'];
export const KIND_OF: Record<WallTab, BoardKind> = {
  today: 'daily',
  speed: 'speed',
  stars: 'score',
  streaks: 'streak',
};
const TAB = {
  today: ['📅', 'Today', 'Shift of the Day', 'Employee of the Day'],
  speed: ['⏱️', 'Speed', 'Speed Legends', 'Fastest Hands'],
  stars: ['⭐', 'Stars', 'Star Collectors', 'Star of the Store'],
  streaks: ['🔥', 'Streaks', 'Never Missed a Shift', 'Never Late'],
} as const;
const SUBTITLE: Record<WallTab, (map: string) => string> = {
  today: () => 'Fastest to finish',
  speed: (map) => `${map} · from a fresh start to 100%`,
  stars: (map) => `${map} · most Stars earned`,
  streaks: () => 'Most Daily Shifts in a row',
};
const SWIPE_PX = 60;

/** "Today", or the day's UTC date like "Nov 3". */
const dayLabel = (day: number, today: number): string =>
  day === today
    ? 'Today'
    : new Date(dailyDate(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Sim ticks at 60 Hz as m:ss.cc (m:ss when `whole`), or h:mm:ss for long Runs. */
export function clockOf(ticks: number, whole = false): string {
  const s = ticks / 60;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(sec)).padStart(2, '0')}`
    : whole
      ? `${m}:${String(Math.floor(sec)).padStart(2, '0')}`
      : `${m}:${sec.toFixed(2).padStart(5, '0')}`;
}

const valueOf = (tab: WallTab, r: Row): string =>
  tab === 'stars' ? `⭐ ${r.value.toLocaleString('en-US')}` : tab === 'streaks' ? `🔥 ${r.value}` : clockOf(r.value);

const rowOf = (tab: WallTab, r: Row, i: number) => (
  <WallRow key={i} rank={r.rank} nickname={r.nickname} value={valueOf(tab, r)} me={r.you} />
);

function Frames({ tab, top }: { tab: WallTab; top: Row[] }) {
  const frame = (r: Row | undefined, first: boolean) =>
    r ? (
      <div class={`wall-frame ${first ? 'first' : ''}`} data-label={first ? TAB[tab][3] : undefined}>
        <span class="medal">{['🥇', '🥈', '🥉'][Math.min(2, r.rank - 1)]}</span>
        <span class="pic" style={{ '--c': colourOf(r.nickname) }}>
          {initials(r.nickname)}
        </span>
        <b>{r.nickname}</b>
        <span class="v">{valueOf(tab, r)}</span>
      </div>
    ) : (
      <div class="wall-frame empty" />
    );
  return (
    <div class="wall-frames">
      {frame(top[1], false)}
      {frame(top[0], true)}
      {frame(top[2], false)}
    </div>
  );
}

function Body({ v, a }: { v: WallView; a: WallActions }) {
  const b = v.board;
  if (b === null)
    return (
      <div class="wall-rows">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} class="wall-skel" />
        ))}
      </div>
    );
  if (b === 'offline')
    return (
      <div class="wall-state">
        <span>📡</span>
        <b>The Wall is out of reach</b>
        <p>Check your connection. The game plays on without it.</p>
        <Btn actions={a} onClick={a.retry}>
          ↻ Try again
        </Btn>
      </div>
    );
  if (!b.top.length)
    return (
      <div class="wall-state">
        <span>🖼️</span>
        <b>This wall is empty</b>
        <p>Be the first one up here.</p>
      </div>
    );
  return (
    <div class="wall-lists">
      <div>
        <Frames tab={v.tab} top={b.top} />
        {!v.hasDevice && (
          <JoinCard title="You're not on the Wall yet" line="Pick a Nickname to get your times up here." a={a} />
        )}
      </div>
      <div>
        {b.you && (
          <section>
            <h4 class="wall-h4">Around you</h4>
            <div class="wall-rows">{b.you.around.map((r, i) => rowOf(v.tab, r, i))}</div>
          </section>
        )}
        {b.top.length > 3 && (
          <section>
            <h4 class="wall-h4">Everyone · {countText(b.total)}</h4>
            <div class="wall-rows">{b.top.slice(3).map((r, i) => rowOf(v.tab, r, i))}</div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Fixed size whatever the tab; swipe the body for the next tab. Only ✕ closes it. */
export function WallPopup({ v, a }: { v: WallView; a: WallActions }) {
  const start = useRef<number | null>(null);
  const perMap = v.tab === 'speed' || v.tab === 'stars';
  const map = v.maps.find((m) => m.id === v.map);
  const step = (d: number) => {
    const next = TABS[TABS.indexOf(v.tab) + d];
    if (!next) return;
    a.click();
    a.tab(next);
  };
  return (
    <div class="wall-shell">
      <Popup
        title="🏅 Wall of Fame"
        close={a.close}
        foot={
          v.tab === 'today' ? (
            <Btn class="buy" actions={a} onClick={a.playShift}>
              ▶ Play today's Shift
            </Btn>
          ) : (
            perMap &&
            map?.playable && (
              <Btn class="buy" actions={a} onClick={() => a.play(map.id)}>
                ▶ Play {map.name}
              </Btn>
            )
          )
        }
      >
        <nav class="wall-tabs">
          {TABS.map((t) => (
            <button key={t} class={t === v.tab ? 'on' : ''} onClick={() => (a.click(), a.tab(t))}>
              <span>{TAB[t][0]}</span>
              {TAB[t][1]}
            </button>
          ))}
        </nav>
        <div
          class="wall-body"
          onPointerDown={(e) => (start.current = e.clientX)}
          onPointerUp={(e) => {
            if (start.current === null) return;
            const dx = e.clientX - start.current;
            start.current = null;
            if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1);
          }}
        >
          <div class="wall-sec">
            {v.tab === 'today' ? (
              <div class="wall-days">
                <button class="round" disabled={v.day <= 1} onClick={() => (a.click(), a.day(v.day - 1))}>
                  ◀
                </button>
                <h3>
                  Shift #{v.day} · {dayLabel(v.day, v.today)}
                </h3>
                <button class="round" disabled={v.day >= v.today} onClick={() => (a.click(), a.day(v.day + 1))}>
                  ▶
                </button>
              </div>
            ) : (
              <h3>{TAB[v.tab][2]}</h3>
            )}
            <small>{SUBTITLE[v.tab](map?.name ?? '')}</small>
          </div>
          {perMap && (
            <div class="wall-chips">
              {v.maps.map((m) => (
                <button key={m.id} class={m.id === v.map ? 'on' : ''} onClick={() => (a.click(), a.map(m.id))}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <Body v={v} a={a} />
        </div>
      </Popup>
    </div>
  );
}
