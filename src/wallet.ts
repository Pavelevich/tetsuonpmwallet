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
 * Derive the public key from a private key using proper secp256k1
 * This uses elliptic curve point multiplication for cryptographic correctness
 */
export function derivePublicKey(privateKeyHex: string): string {
  try {
    // Use elliptic.js for proper secp256k1 key derivation
    // This performs: pubkey = privatekey * G (point multiplication on secp256k1 curve)
    const EC = require('elliptic').ec;
    const ec = new EC('secp256k1');

    // Import the private key (32 bytes, hex format)
    const key = ec.keyFromPrivate(privateKeyHex, 'hex');

    // Get the compressed public key (33 bytes: 02/03 prefix + 32 bytes x-coordinate)
    const pubKeyCompressed = key.getPublic(true, 'hex');

    return pubKeyCompressed;
  } catch (error) {
    throw new WalletError(`Failed to derive public key: ${(error as Error).message}`);
  }
}

/**
 * Derive public key using legacy HMAC method
 * Only used for backward compatibility with old wallets
 */
export function derivePublicKeyLegacy(privateKeyHex: string): string {
  const privateKeyBuffer = fromHex(privateKeyHex);

  const hmac = createHmac('sha256', Buffer.from('secp256k1'));
  hmac.update(privateKeyBuffer);
  const publicKeyBuffer = hmac.digest();

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
