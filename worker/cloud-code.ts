// The Cloud Code: `WBLY-` + 16 Crockford base32 characters (80 random bits). Only its SHA-256 is stored.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = 'WBLY';
const LENGTH = 16;

export function newCloudCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array((LENGTH * 5) / 8));
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let code = PREFIX;
  for (let i = 0; i < LENGTH; i++) {
    if (i % 4 === 0) code += '-';
    code += ALPHABET[Number((bits >> BigInt((LENGTH - 1 - i) * 5)) & 31n)];
  }
  return code;
}

/** The 16 code characters, or null when it isn't a Cloud Code. Accepts any case, missing dashes, and I/L/O typos. */
function canonical(code: string): string | null {
  const flat = code.toUpperCase().replace(/[\s-]/g, '');
  if (!flat.startsWith(PREFIX)) return null;
  const body = flat.slice(PREFIX.length).replace(/[IL]/g, '1').replace(/O/g, '0');
  return body.length === LENGTH && [...body].every((c) => ALPHABET.includes(c)) ? body : null;
}

/** SHA-256 of the canonical code, or null for anything that isn't one. */
export async function hashCloudCode(code: string): Promise<ArrayBuffer | null> {
  const body = canonical(code);
  return body ? crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)) : null;
}
