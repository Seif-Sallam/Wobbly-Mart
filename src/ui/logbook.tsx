// The Logbook: Objectives as tiles, and Stats as small grouped cards for this Map or the whole game.
import { useState } from 'preact/hooks';

export interface LogbookObjective {
  icon: string;
  name: string;
  got: number;
  want: number;
  done: boolean;
}

export interface StatGroup {
  icon: string;
  name: string;
  rows: [string, string][];
}

export interface LogbookView {
  mapName: string;
  score: number;
  /** Score added up over every Map. */
  total: number;
  /** Points one Objective earns. */
  points: number;
  objectives: LogbookObjective[];
  thisMap: StatGroup[];
  whole: StatGroup[];
}

const TABS = ['Objectives', 'This Map', 'Whole game'];
const n = (v: number): string => v.toLocaleString('en-US');

function Tile({ o, points }: { o: LogbookObjective; points: number }) {
  return (
    <div class={`obj-tile ${o.done ? 'done' : ''}`}>
      <div class="obj-ring" style={{ '--p': o.got / o.want }}>
        <img src={o.icon} alt="" />
      </div>
      {o.name}
      <b>{o.done ? `✓ +${points}` : `${n(o.got)}/${n(o.want)}`}</b>
    </div>
  );
}

export function Logbook({
  view,
  tab,
  close,
  click,
}: {
  view: LogbookView;
  tab: number;
  close: () => void;
  click: () => void;
}) {
  const [at, setAt] = useState(tab);
  const done = view.objectives.filter((o) => o.done).length;
  // done Objectives go last
  const objectives = [...view.objectives.filter((o) => !o.done), ...view.objectives.filter((o) => o.done)];
  const groups = at === 1 ? view.thisMap : view.whole;
  return (
    <div class="panel logbook" onPointerDown={(e) => e.stopPropagation()}>
      <div class="logbook-head">
        <h2>📖 {view.mapName}</h2>
        <b>⭐ {n(view.score)}</b>
      </div>
      <p>
        Game total 🏆 {n(view.total)} · {done}/{view.objectives.length} Objectives
      </p>
      <div class="tabs">
        {TABS.map((name, i) => (
          <button
            key={name}
            class={`btn ${i === at ? 'on' : ''}`}
            onClick={() => {
              click();
              setAt(i);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div class="logbook-body">
        {at === 0
          ? objectives.map((o) => <Tile key={o.name} o={o} points={view.points} />)
          : groups.map((g) => (
              <section class="stat-card" key={g.name}>
                <h4>
                  {g.icon} {g.name}
                </h4>
                {g.rows.map(([label, value]) => (
                  <p key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </p>
                ))}
              </section>
            ))}
      </div>
      <button
        class="btn back"
        onClick={() => {
          click();
          close();
        }}
      >
        Close
      </button>
    </div>
  );
}
