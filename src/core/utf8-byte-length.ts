export function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}
