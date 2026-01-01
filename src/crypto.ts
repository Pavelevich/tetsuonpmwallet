/**
 * TETSUO Wallet SDK - Cryptographic Functions
 */

import * as crypto from 'crypto';

/**
 * Hash a value using SHA256
 */
export function sha256(data: string | Buffer): Buffer {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(input).digest();
}

/**
 * Double SHA256 hash (used in Bitcoin-like protocols)
 */
export function doubleSha256(data: string | Buffer): Buffer {
  return sha256(sha256(data));
}

/**
 * RIPEMD160 hash
 */
export function ripemd160(data: Buffer): Buffer {
  return crypto.createHash('ripemd160').update(data).digest();
}

/**
 * Hash160 = RIPEMD160(SHA256(data))
 * Used for address generation
 */
export function hash160(data: Buffer): Buffer {
  return ripemd160(sha256(data));
}

/**
 * Generate random bytes
 */
export function randomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Encode data to hex string
 */
export function toHex(data: Buffer | string): string {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return input.toString('hex');
}

/**
 * Decode hex string to buffer
 */
export function fromHex(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Convert buffer to base58 string (Bitcoin address encoding)
 */
export function toBase58(buffer: Buffer): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;

  for (const byte of buffer) {
    num = num * 256n + BigInt(byte);
  }

  let encoded = '';
  while (num > 0n) {
    encoded = alphabet[Number(num % 58n)] + encoded;
    num = num / 58n;
  }

  // Add leading '1's for leading zero bytes
  for (const byte of buffer) {
    if (byte === 0) {
      encoded = '1' + encoded;
    } else {
      break;
    }
  }

  return encoded || '1';
}

/**
 * Convert base58 string to buffer
 */
export function fromBase58(str: string): Buffer {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  let num = 0n;
  for (const char of str) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * 58n + BigInt(index);
  }

  let bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }

  // Add leading zero bytes
  for (const char of str) {
    if (char === '1') {
      bytes.unshift(0);
    } else {
      break;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Encode data with checksum using base58check (used for addresses)
 */
export function base58check(data: Buffer): string {
  const checksum = doubleSha256(data).slice(0, 4);
  return toBase58(Buffer.concat([data, checksum]));
}

/**
 * Decode base58check data and verify checksum
 */
export function base58checkDecode(encoded: string): Buffer {
  const data = fromBase58(encoded);
  const payload = data.slice(0, -4);
  const checksum = data.slice(-4);

  const calculatedChecksum = doubleSha256(payload).slice(0, 4);
  if (!checksum.equals(calculatedChecksum)) {
    throw new Error('Invalid base58check checksum');
  }

  return payload;
}
