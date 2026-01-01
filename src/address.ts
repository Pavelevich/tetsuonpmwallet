/**
 * TETSUO Wallet SDK - Address Generation & Validation
 */

import { hash160, base58check, base58checkDecode, fromHex } from './crypto';
import { InvalidAddressError } from './types';

// TETSUO address prefix (T = 0x41)
const TETSUO_ADDRESS_PREFIX = 0x41;

/**
 * Generate a TETSUO address from a public key
 * Address format: base58check(prefix + hash160(publicKey))
 */
export function generateAddress(publicKeyHex: string): string {
  const publicKeyBuffer = fromHex(publicKeyHex);

  // Hash the public key: HASH160 = RIPEMD160(SHA256(pubKey))
  const publicKeyHash = hash160(publicKeyBuffer);

  // Add TETSUO prefix (0x41 = 65 = 'T')
  const addressPayload = Buffer.concat([
    Buffer.from([TETSUO_ADDRESS_PREFIX]),
    publicKeyHash
  ]);

  // Encode with base58check
  return base58check(addressPayload);
}

/**
 * Validate a TETSUO address format
 */
export function isValidAddress(address: string): boolean {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // TETSUO addresses start with 'T'
    if (!address.startsWith('T')) {
      return false;
    }

    // Decode and verify checksum
    const decoded = base58checkDecode(address);

    // Check prefix
    if (decoded[0] !== TETSUO_ADDRESS_PREFIX) {
      return false;
    }

    // Check length (1 byte prefix + 20 bytes hash160)
    if (decoded.length !== 21) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate and return the address, or throw error
 */
export function validateAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new InvalidAddressError(address);
  }
  return address;
}

/**
 * Get the hash160 from a TETSUO address
 */
export function addressToHash160(address: string): Buffer {
  if (!isValidAddress(address)) {
    throw new InvalidAddressError(address);
  }

  const decoded = base58checkDecode(address);
  return decoded.slice(1); // Remove prefix byte
}

/**
 * Get the public key hash from an address
 */
export function getAddressHash(address: string): string {
  const hash = addressToHash160(address);
  return hash.toString('hex');
}
