// End of Shift: the time, Score and Money, the rank climbing to its place of the day, the Streak, Around you.
import type { Row, ShiftResponse } from '../../worker/api';
import { formatMoney } from '../format';
import { Btn } from './btn';
import { Popup } from './popup';
import { Climb } from './run-end';
import { clockOf, JoinCard, WallRow } from './wall';

/** `result`: the Board's answer, or why there is none ('join' = no Device, 'debug' = played with ?debug). */
export interface ShiftEndView {
  day: number;
  ticks: number;
  score: number;
  money: number;
  result: ShiftResponse | 'join' | 'sending' | 'offline' | 'update' | 'stale' | 'refused' | 'debug' | 'local';
  around: Row[] | null;
}

export interface ShiftEndActions {
  wall: () => void;
  join: () => void;
  retry: () => void;
  again: () => void;
  close: () => void;
  click: () => void;
}

const NOTE = {
  sending: '📡 Putting it on the Wall…',
  offline: 'Saved, will post when you’re back online.',
  update: 'A new version is out · Reload to post your Shifts.',
  stale: "Saved: your Cloud Code isn't recognised. Enter it again in Settings and the Shift goes up.",
  refused: "This Shift can't go on the Wall.",
  debug: "Played with ?debug, so it isn't ranked.",
  local: '',
};

/** `online`: this build has the Board API (`local` results then never show). */
export function ShiftEndPopup({ v, a, online }: { v: ShiftEndView; a: ShiftEndActions; online: boolean }) {
  const r = v.result;
  return (
    <Popup
      title={`📅 Shift #${v.day} done!`}
      close={a.close}
      foot={
        <>
          {online && (
            <Btn class="buy" actions={a} onClick={a.wall}>
              🏅 See the Wall
            </Btn>
          )}
          <Btn actions={a} onClick={a.again}>
            ↺ Try again
          </Btn>
          <Btn actions={a} onClick={a.close}>
            Keep playing
          </Btn>
        </>
      }
    >
      <div class="run-time">{clockOf(v.ticks)}</div>
      <div class="run-pills">
        <span>⭐ {v.score.toLocaleString('en-US')}</span>
        <span>💵 {formatMoney(v.money)}</span>
      </div>
      {typeof r === 'object' && (
        <>
          <Climb rank={r.rank} total={Math.max(r.rank, r.total)} />
          <p class="popup-lead">
            of {r.total.toLocaleString('en-US')} today{r.improved ? '' : ' · your best stays'}
          </p>
          <p class="popup-lead">
            🔥 {r.streak} {r.streak === 1 ? 'Shift' : 'Shifts'} in a row
          </p>
        </>
      )}
      {r === 'join' && <JoinCard title="Put this Shift on the Wall" line="Pick a Nickname and it goes up." a={a} />}
      {typeof r === 'string' && r !== 'join' && r !== 'local' && (
        <div class="run-note">
          {NOTE[r]}
          {r === 'offline' && (
            <Btn actions={a} onClick={a.retry}>
              Retry
            </Btn>
          )}
        </div>
      )}
      {v.around && (
        <section>
          <h4 class="wall-h4">Around you</h4>
          <div class="wall-rows">
            {v.around.map((row, i) => (
              <WallRow key={i} rank={row.rank} nickname={row.nickname} value={clockOf(row.value)} me={row.you} />
            ))}
          </div>
        </section>
      )}
    </Popup>
  );
}
