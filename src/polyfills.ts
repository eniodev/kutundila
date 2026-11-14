// Minimal TextDecoder fallback for engines that lack it (PLYLoader uses it).
// PLY headers and ASCII bodies are plain ASCII, so byte → char is enough.
if (typeof globalThis.TextDecoder === 'undefined') {
  class AsciiTextDecoder {
    readonly encoding = 'utf-8';
    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return '';
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      const CHUNK = 0x8000;
      let out = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        out += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + CHUNK) as unknown as number[],
        );
      }
      return out;
    }
  }
  (globalThis as any).TextDecoder = AsciiTextDecoder;
}
