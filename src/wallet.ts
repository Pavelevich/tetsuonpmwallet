/**
 * TETSUO Wallet SDK - Wallet Generation & Key Management
 */

import * as bip39 from 'bip39';
import { createHmac, randomBytes } from 'crypto';
import { sha256, toHex, fromHex } from './crypto';
import { generateAddress } from './address';
import { GeneratedWallet, ImportedWallet, WalletError } from './types';

const TETSUO_SALT = 'tetsuo_wallet_salt';

/**
 * Generate a new wallet with mnemonic
 * Uses BIP39 for mnemonic generation and custom key derivation for TETSUO
 */
export async function generateWallet(): Promise<GeneratedWallet> {
  // Generate 128-bit entropy for 12-word mnemonic
  const entropy = randomBytes(16);
  const mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));

  // Derive keys from mnemonic
  const wallet = await deriveFromMnemonic(mnemonic);

  return {
    mnemonic,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    address: wallet.address
  };
}

/**
 * Import a wallet from an existing mnemonic phrase
 */
export async function importFromMnemonic(mnemonic: string): Promise<GeneratedWallet> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new WalletError('Invalid BIP39 mnemonic phrase');
  }

  const wallet = await deriveFromMnemonic(mnemonic);

  return {
    mnemonic,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    address: wallet.address
  };
}

/**
 * Import a wallet from a private key (hex format)
 */
export function importFromPrivateKey(privateKeyHex: string): ImportedWallet {
  if (!privateKeyHex || privateKeyHex.length !== 64) {
    throw new WalletError('Invalid private key. Must be 64 hex characters.');
  }

  try {
    const privateKeyBuffer = fromHex(privateKeyHex);
    const publicKey = derivePublicKey(privateKeyHex);

    const address = generateAddress(publicKey);

    return {
      privateKey: privateKeyHex,
      publicKey,
      address
    };
  } catch (error) {
    throw new WalletError(`Failed to import private key: ${(error as Error).message}`);
  }
}

/**
 * Derive keys from a mnemonic phrase
 * Uses PBKDF2 with the mnemonic as password
 */
async function deriveFromMnemonic(mnemonic: string): Promise<{ privateKey: string; publicKey: string; address: string }> {
  // Convert mnemonic to seed using PBKDF2
  const seed = await bip39.mnemonicToSeed(mnemonic);

  // Hash seed to get private key
  const hash1 = sha256(Buffer.concat([seed, Buffer.from(TETSUO_SALT)]));
  const hash2 = sha256(Buffer.concat([hash1, Buffer.from(TETSUO_SALT)]));

  const privateKey = hash2.toString('hex');
  const publicKey = derivePublicKey(privateKey);
  const address = generateAddress(publicKey);

  return { privateKey, publicKey, address };
}

/**
 * Derive the public key from a private key (secp256k1)
 * This is a simplified version using HMAC-based derivation
 */
export function derivePublicKey(privateKeyHex: string): string {
  // In production, use a proper secp256k1 library
  // For now, we'll use HMAC-based derivation for demo purposes
  const privateKeyBuffer = fromHex(privateKeyHex);

  // Create a deterministic public key from private key
  // This is simplified - in production use proper secp256k1 library
  const hmac = createHmac('sha256', Buffer.from('secp256k1'));
  hmac.update(privateKeyBuffer);
  const publicKeyBuffer = hmac.digest();

  // Ensure it's 33 bytes (compressed public key format)
  // Add compression byte (0x02 for even y, 0x03 for odd y)
  const compressionByte = publicKeyBuffer[publicKeyBuffer.length - 1] % 2 === 0 ? 0x02 : 0x03;
  const compressedKey = Buffer.concat([
    Buffer.from([compressionByte]),
    publicKeyBuffer.slice(0, 32)
  ]);

  return compressedKey.toString('hex');
}

/**
 * Validate if a mnemonic phrase is valid
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Get supported mnemonic word count
 */
export function getSupportedMnemonicLengths(): number[] {
  return [12, 15, 18, 21, 24];
}
