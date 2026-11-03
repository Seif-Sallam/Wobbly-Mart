// The Nickname character rule. Pure, so the client's Nickname card can share it.

export const NICKNAME_MAX = 16;
const NICKNAME_RULE = new RegExp(`^(?=.*[A-Za-z0-9])[A-Za-z0-9 _-]{3,${NICKNAME_MAX}}$`);

/** Trimmed with inner spaces collapsed, or null when it breaks the rule: 3–16 of letters, digits, space, `_`, `-`, with a letter or digit. */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/ +/g, ' ');
  return NICKNAME_RULE.test(name) ? name : null;
}
