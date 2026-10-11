// Shared stream bound; never include body content in thrown errors.
export class PublicBodyError extends Error {
  constructor(readonly status: 400 | 413) { super("Invalid request"); }
}
export async function readBoundedJson(body: ReadableStream<Uint8Array> | null, maximum: number, milliseconds: number): Promise<unknown> {
  if (!body) throw new PublicBodyError(400);
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new PublicBodyError(400)); }, milliseconds); });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), deadline]); if (next.done) break;
      size += next.value.byteLength; if (size > maximum) throw new PublicBodyError(413); chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) { throw error instanceof PublicBodyError ? error : new PublicBodyError(400); }
  finally {
    clearTimeout(timer); void reader.cancel().catch(() => {});
    // A hostile/stalled source must not extend the request deadline during cancel.
    try { reader.releaseLock(); } catch { /* The source is being cancelled. */ }
  }
}
