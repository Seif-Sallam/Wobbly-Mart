// End of Run: the time, the Map and its Openings, the rank climbing to its place, Around you.
import { useEffect, useState } from 'preact/hooks';
import type { RankResponse, Row } from '../../worker/api';
import { FEEL } from '../feel';
import { Btn } from './btn';
import { Popup } from './popup';
import { clockOf, JoinCard, rankText, WallRow } from './wall';

/** `result`: the Board's answer, or why there is none yet ('join' = no Device, 'sending' = on its way). */
export interface RunEndView {
  mapId: string;
  mapName: string;
  ticks: number;
  openings: number;
  result: RankResponse | 'join' | 'sending' | 'offline' | 'update' | 'stale' | 'refused';
  around: Row[] | null;
}

export interface RunEndActions {
  wall: () => void;
  join: () => void;
  retry: () => void;
  close: () => void;
  click: () => void;
}

/** Counts from the Board's last place up to `rank`, easing out. */
export function Climb({ rank, total }: { rank: number; total: number }) {
  const [shown, setShown] = useState(total);
  useEffect(() => {
    const t0 = performance.now();
    let frame = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / FEEL.score.rankClimbMs);
      setShown(Math.round(total + (rank - total) * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rank, total]);
  return <div class="run-climb">#{rankText(shown)}</div>;
}

const NOTE = {
  sending: '📡 Putting it on the Wall…',
  offline: "📡 Saved: it goes on the Wall when you're back online.",
  update: 'A new version is out · Reload to post your Runs.',
  stale: "Saved: your Cloud Code isn't recognised. Enter it again in Settings and the Run goes up.",
  refused: "This Run can't go on the Wall.",
};

/** An end screen's Around you, times as m:ss.cc. */
export function AroundYou({ rows }: { rows: Row[] }) {
  return (
    <section>
      <h4 class="wall-h4">Around you</h4>
      <div class="wall-rows">
        {rows.map((row, i) => (
          <WallRow key={i} rank={row.rank} nickname={row.nickname} value={clockOf(row.value)} me={row.you} />
        ))}
      </div>
    </section>
  );
}

export function RunEndPopup({ v, a }: { v: RunEndView; a: RunEndActions }) {
  const r = v.result;
  return (
    <Popup
      title="⏱️ Run complete!"
      close={a.close}
      foot={
        <>
          <Btn class="buy" actions={a} onClick={a.wall}>
            🏅 See the Wall
          </Btn>
          <Btn actions={a} onClick={a.close}>
            Keep playing
          </Btn>
        </>
      }
    >
      <div class="run-time">{clockOf(v.ticks)}</div>
      <div class="run-pills">
        <span>{v.mapName}</span>
        <span>
          {v.openings} {v.openings === 1 ? 'Opening' : 'Openings'}
        </span>
      </div>
      {typeof r === 'object' && (
        <>
          <Climb rank={r.rank} total={Math.max(r.rank, r.total)} />
          <p class="popup-lead">
            of {r.total.toLocaleString('en-US')} on this Map{r.improved ? '' : ' · your best stays'}
          </p>
        </>
      )}
      {r === 'join' && <JoinCard title="Put this Run on the Wall" line="Pick a Nickname and it goes up." a={a} />}
      {typeof r === 'string' && r !== 'join' && (
        <div class="run-note">
          {NOTE[r]}
          {r === 'offline' && (
            <Btn actions={a} onClick={a.retry}>
              Retry
            </Btn>
          )}
        </div>
      )}
      {v.around && <AroundYou rows={v.around} />}
    </Popup>
  );
}
