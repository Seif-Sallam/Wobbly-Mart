// Nickname blocklist, Worker only. Add a slipped-through word to OWNER_WORDS.
import { LDNOOBW } from './blocklist-words';

const OWNER_WORDS: readonly string[] = [];

const RESERVED: readonly string[] = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'wobblymart',
  'wobbly mart',
  'seif',
  'sallam',
  'official',
  'staff team',
  'developer',
];

/**
 * Roots that block anywhere, even inside a word or across spaces ("F u c k"). Every other listed word blocks
 * only as a whole word of the name, or inside a word when it is long (LONG letters or more), so "Peacocks",
 * "Thorny Rose", "Basement Bob" and "Therapist" stay allowed. Words with no letters ("455") are not checked.
 */
const ANYWHERE = ['fuck', 'cunt', 'shit', 'jizz', 'twat', 'slut', 'porn', 'nigg'];
const LONG = 7;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Lowercase, leetspeak undone, then everything but a-z dropped. */
export const normalise = (text: string): string =>
  [...text.toLowerCase()]
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');

const words = new Set([...LDNOOBW, ...OWNER_WORDS, ...RESERVED].map(normalise).filter((w) => w.length > 1));
const long = [...words].filter((w) => w.length >= LONG);

export function isBlocked(nickname: string): boolean {
  const tokens = nickname
    .split(/[ _-]+/)
    .filter((t) => /[a-z]/i.test(t))
    .map(normalise);
  const joined = tokens.join('');
  if (ANYWHERE.some((w) => joined.includes(w))) return true;
  return [joined, ...tokens].some((t) => words.has(t) || long.some((w) => t.includes(w)));
}
