// Wall of Fame pieces: a row with its initials badge.
import { AVATAR_COLOURS } from '../palette';

const colourOf = (name: string): string =>
  AVATAR_COLOURS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % AVATAR_COLOURS.length];

const initials = (name: string): string =>
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

/** Ranks above 1,000 come from the Worker as 1001. */
export const rankText = (rank: number): string => (rank > 1000 ? '1000+' : String(rank));

export function WallRow(props: { rank: number; nickname: string; value: string; me?: boolean }) {
  return (
    <div class={`wall-row ${props.me ? 'me' : ''}`}>
      <i>{rankText(props.rank)}</i>
      <Avatar name={props.nickname} />
      <b>{props.nickname}</b>
      <span>{props.value}</span>
    </div>
  );
}
