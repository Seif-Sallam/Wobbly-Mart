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
  'support',
  'system',
  'developer',
];

/**
 * Short words (under 5 letters) that block wherever they appear. Every other short word blocks only as a
 * whole word of the name, so "Spicy Chef", "Peacock" and "Button" stay allowed.
 */
const ANYWHERE = new Set(['fuck', 'cunt', 'shit', 'jizz', 'twat', 'wank', 'porn', 'slut']);
const SHORT = 5;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Lowercase, leetspeak undone, then everything but a–z dropped. */
export const normalise = (text: string): string =>
  [...text.toLowerCase()]
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');

const words = [...new Set([...LDNOOBW, ...OWNER_WORDS, ...RESERVED].map(normalise).filter((w) => w.length > 1))];
const substrings = words.filter((w) => w.length >= SHORT || ANYWHERE.has(w));
const wholeWords = new Set(words.filter((w) => w.length < SHORT));

export function isBlocked(nickname: string): boolean {
  const joined = normalise(nickname);
  if (substrings.some((w) => joined.includes(w))) return true;
  return [joined, ...nickname.split(/[ _-]+/).map(normalise)].some((t) => wholeWords.has(t));
}
