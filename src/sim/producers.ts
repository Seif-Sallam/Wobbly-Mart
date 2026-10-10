import type { ProducerStation, World } from './world';
import { DT } from './world';
import { workMultiplier } from './economy';

export function updateProducers(w: World): void {
  for (const st of w.stations.values()) {
    if (st.kind !== 'producer') continue;
    const type = w.map.producers[st.type];
    if (st.plants.length) {
      for (let i = 0; i < st.plants.length; i++) {
        if (st.plants[i] <= 0) continue;
        st.plants[i] -= DT;
        if (st.plants[i] <= 0) {
          st.plants[i] = 0;
          w.events.push({ type: 'produced', station: st.id });
        }
      }
      continue;
    }
    if (st.work > 0) {
      st.work -= DT;
      if (st.work > 0) continue;
      st.work = 0;
      st.tray++;
      w.events.push({ type: 'produced', station: st.id });
    }
    if (st.tray >= (type.trayCap ?? 0) || !type.inputs.every((p) => (st.input[p] ?? 0) > 0)) continue;
    for (const p of type.inputs) st.input[p]--;
    st.work = type.workTime * workMultiplier(w, st.type);
  }
}

/** An Animal or Machine sitting idle for want of an input (a full Tray doesn't count). */
export function stalled(w: World, st: ProducerStation): boolean {
  const type = w.map.producers[st.type];
  return st.work <= 0 && st.tray < (type.trayCap ?? 0) && type.inputs.some((p) => !(st.input[p] ?? 0));
}
