import { sha256, doubleSha256, toHex, fromHex, toBase58, fromBase58, base58check, base58checkDecode } from '../src/crypto';

describe('Crypto', () => {
  it('should hash data with SHA256', () => {
    const data = 'test data';
    const hash = sha256(data);

    expect(hash).toBeInstanceOf(Buffer);
    expect(hash.length).toBe(32);
  });

  it('should compute double SHA256', () => {
    const data = 'test data';
    const hash = doubleSha256(data);

    expect(hash).toBeInstanceOf(Buffer);
    expect(hash.length).toBe(32);
  });

  it('should convert to and from hex', () => {
    const original = Buffer.from('test data');
    const hex = toHex(original);
    const decoded = fromHex(hex);

    expect(decoded).toEqual(original);
  });

  it('should convert strings to and from hex', () => {
    const text = 'hello world';
    const hex = toHex(text);
    const decoded = fromHex(hex).toString('utf-8');

    expect(decoded).toBe(text);
  });

  it('should encode and decode base58', () => {
    const data = Buffer.from('test data');
    const encoded = toBase58(data);
    const decoded = fromBase58(encoded);

    expect(decoded).toEqual(data);
  });

  it('should encode and decode base58check', () => {
    const data = Buffer.from('test data');
    const encoded = base58check(data);
    const decoded = base58checkDecode(encoded);

    expect(decoded).toEqual(data);
  });

  it('should reject invalid base58check', () => {
    expect(() => {
      base58checkDecode('invalid');
    }).toThrow();
  });

  it('should handle empty data', () => {
    const empty = Buffer.alloc(0);
    const hash = sha256(empty);

    expect(hash).toBeInstanceOf(Buffer);
    expect(hash.length).toBe(32);
  });
});
