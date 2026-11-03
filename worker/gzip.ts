// Gzipped JSON carried as base64: Replays and cloud saves. Shared by the Worker and the game.

export async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return toBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Null for anything that isn't base64. */
export function fromBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The text, or null when it isn't gzip or unpacks past `max` bytes (a gzip bomb gets no further). */
export async function gunzip(bytes: Uint8Array<ArrayBuffer>, max: number): Promise<string | null> {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const decoder = new TextDecoder();
    let text = '';
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.byteLength;
      if (size > max) return null;
      text += decoder.decode(chunk, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return null;
  }
}
