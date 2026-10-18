// The running Challenge as the HUD's ring timer: icon, short name, what sits in the ring and how much time is left.
import type { World } from '../sim/world';
import type { ChallengeCard } from '../ui/hud';
import { TUNING } from '../sim/tuning';
import { FEEL } from '../feel';
import { emojiUrl, iconUrl } from '../view/thumbs';

export function challengeCard(w: World): ChallengeCard | null {
  const c = w.challenge;
  if (!c) return null;
  const secs = Math.max(0, Math.ceil(c.time - c.t));
  const counted = `${c.progress}/${c.goal}`;
  const product = w.map.products[c.target ?? ''];
  const shelf = w.stations.get(c.target ?? '');
  const shelved = shelf?.kind === 'shelf' ? w.map.products[shelf.product] : undefined;
  const card = (icon: string, name: string, text: string) => ({
    icon,
    name,
    text,
    left: 1 - c.t / c.time,
    low: secs <= FEEL.score.ringRedAt,
  });
  switch (c.kind) {
    case 'checkout':
      return card(emojiUrl('🛒'), `Check out ${c.goal}`, counted);
    case 'noMess':
      return card(emojiUrl('🧽'), 'No new Mess', `${secs}`);
    case 'fillShelf':
      return card(iconUrl(shelved?.model ?? ''), `Fill ${shelved?.name ?? 'the'} Shelf`, `${secs}`);
    case 'make':
      return card(iconUrl(product?.model ?? ''), `Make ${c.goal} ${product?.name ?? ''}`, counted);
    case 'sell':
      return card(iconUrl(product?.model ?? ''), `Sell ${c.goal} ${product?.name ?? ''}`, counted);
    case 'delivery':
      return card(iconUrl('van'), `Delivery, ${TUNING.challenges.kinds.delivery.timeLeft} s left`, `${secs}`);
  }
}
