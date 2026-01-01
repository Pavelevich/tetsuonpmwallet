/**
 * TETSUO Wallet SDK - Transaction Building & Signing
 */

import { createHmac } from 'crypto';
import { doubleSha256, toHex, fromHex } from './crypto';
import { validateAddress, addressToHash160 } from './address';
import { SignedTransaction, TransactionInput, TransactionOutput, UTXO, InsufficientFundsError, WalletError } from './types';
import { derivePublicKey, derivePublicKeyLegacy } from './wallet';
import { hash160 } from './crypto';

const COIN_VALUE = 100_000_000; // 1 TETSUO = 100M satoshis
const MIN_FEE = 25000; // Minimum fee in satoshis
const FEE_PER_BYTE = 100; // Satoshis per byte

/**
 * Build an unsigned transaction
 */
export function buildTransaction(
  fromAddress: string,
  toAddress: string,
  amount: number,
  utxos: UTXO[],
  changeAddress: string
): { inputs: TransactionInput[]; outputs: TransactionOutput[]; fee: number } {
  // Validate addresses
  validateAddress(fromAddress);
  validateAddress(toAddress);
  validateAddress(changeAddress);

  // Convert TETSUO to satoshis
  const amountSatoshis = Math.floor(amount * COIN_VALUE);

  // Select UTXOs (simple algorithm: oldest first)
  let selectedUTXOs: UTXO[] = [];
  let totalInput = 0;

  const sortedUTXOs = [...utxos].sort((a, b) => a.confirmations - b.confirmations);

  for (const utxo of sortedUTXOs) {
    selectedUTXOs.push(utxo);
    totalInput += utxo.value;

    // Estimate fee (rough estimate)
    const estimatedSize = selectedUTXOs.length * 148 + 2 * 34 + 10; // inputs + outputs + overhead
    const estimatedFee = Math.max(MIN_FEE, Math.ceil(estimatedSize / 1000) * FEE_PER_BYTE);

    if (totalInput >= amountSatoshis + estimatedFee) {
      break;
    }
  }

  // Calculate final fee
  const inputSize = selectedUTXOs.length * 148;
  const outputSize = 2 * 34; // Send + change
  const overhead = 10;
  const txSize = inputSize + outputSize + overhead;
  const fee = Math.max(MIN_FEE, Math.ceil(txSize / 1000) * FEE_PER_BYTE);

  if (totalInput < amountSatoshis + fee) {
    throw new InsufficientFundsError(amountSatoshis + fee, totalInput);
  }

  // Build inputs
  const inputs: TransactionInput[] = selectedUTXOs.map(utxo => ({
    txid: utxo.txid,
    vout: utxo.vout,
    sequence: 0xffffffff
  }));

  // Build outputs
  const outputs: TransactionOutput[] = [
    {
      address: toAddress,
      value: amountSatoshis
    }
  ];

  // Add change output if needed
  const change = totalInput - amountSatoshis - fee;
  if (change > 0) {
    outputs.push({
      address: changeAddress,
      value: change
    });
  }

  return { inputs, outputs, fee };
}

/**
 * Create transaction hex from inputs and outputs
 */
export function createTransactionHex(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  scriptPubKeys?: string[]
): string {
  let hex = '';

  // Version (4 bytes)
  hex += '01000000';

  // Input count (variable length int)
  hex += encodeVarInt(inputs.length);

  // Inputs
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    // Previous transaction ID (little endian)
    hex += reverseTxid(input.txid);

    // Previous output index (4 bytes, little endian)
    hex += reverseBytesInPairs(input.vout.toString(16).padStart(8, '0'));

    // Script length and script
    // If scriptPubKeys provided (for signing), use them; otherwise empty
    if (scriptPubKeys && scriptPubKeys[i]) {
      const scriptPubKey = scriptPubKeys[i];
      hex += encodeVarInt(scriptPubKey.length / 2);
      hex += scriptPubKey;
    } else {
      hex += '00'; // 0 length script (unsigned)
    }

    // Sequence
    hex += reverseBytesInPairs((input.sequence ?? 0xffffffff).toString(16).padStart(8, '0'));
  }

  // Output count
  hex += encodeVarInt(outputs.length);

  // Outputs
  for (const output of outputs) {
    // Value (8 bytes, little endian)
    const valueHex = output.value.toString(16).padStart(16, '0');
    hex += reverseBytesInPairs(valueHex);

    // Script pubkey (pay to pubkey hash)
    const hash160 = addressToHash160(output.address);
    const scriptPubKey = createPayToPubKeyHashScript(hash160);
    hex += encodeVarInt(scriptPubKey.length / 2);
    hex += scriptPubKey;
  }

  // Locktime (4 bytes)
  hex += '00000000';

  return hex;
}

/**
 * Sign a transaction with proper TETSUO key derivation
 */
export function signTransaction(
  transactionHex: string,
  privateKey: string,
  inputs: TransactionInput[],
  utxos?: any[]
): string {
  try {
    const EC = require('elliptic').ec;
    const ec = new EC('secp256k1');

    // Auto-detect wallet type (HMAC vs secp256k1) by comparing hash160 with scriptPubKey
    let pubKeyCompressed = '';
    let derivationMethod = 'secp256k1';

    // First try secp256k1 (new wallets)
    pubKeyCompressed = derivePublicKey(privateKey);

    // If we have UTXOs with P2PKH scripts, detect which derivation method to use
    if (utxos && utxos.length > 0 && utxos[0].scriptPubKey) {
      const scriptPubKey = utxos[0].scriptPubKey;

      // For P2PKH scripts: 76a914 + 20bytes + 88ac
      if (scriptPubKey.startsWith('76a914') && scriptPubKey.length === 50) {
        const hashFromScript = scriptPubKey.slice(6, 46); // Extract hash160 from script

        // Check secp256k1
        const hash160Secp = hash160(fromHex(pubKeyCompressed)).toString('hex');
        if (hash160Secp === hashFromScript) {
          derivationMethod = 'secp256k1';
        } else {
          // Try legacy HMAC derivation
          const pubKeyLegacy = derivePublicKeyLegacy(privateKey);
          const hash160Hmac = hash160(fromHex(pubKeyLegacy)).toString('hex');
          if (hash160Hmac === hashFromScript) {
            pubKeyCompressed = pubKeyLegacy;
            derivationMethod = 'hmac';
          }
          // else: keep secp256k1 as fallback (shouldn't happen for valid wallets)
        }
      }
    }

    const pubKeyBuffer = fromHex(pubKeyCompressed);

    // Store all scriptSigs
    const scriptSigs: string[] = [];

    // Sign each input
    for (let i = 0; i < inputs.length; i++) {
      let scriptPubKey = '';
      if (utxos && utxos[i] && utxos[i].scriptPubKey) {
        scriptPubKey = utxos[i].scriptPubKey;
      } else {
        throw new Error('Missing UTXO scriptPubKey for input ' + i);
      }

      // Create preimage: transaction with this input's scriptPubKey in place of scriptSig
      let preimageHex = '01000000'; // Version
      preimageHex += encodeVarInt(inputs.length);

      // Add inputs with scriptPubKey for the one being signed
      for (let j = 0; j < inputs.length; j++) {
        const input = inputs[j];
        preimageHex += reverseTxid(input.txid);
        preimageHex += reverseBytesInPairs(input.vout.toString(16).padStart(8, '0'));

        if (j === i) {
          // This is the input we're signing - use scriptPubKey
          preimageHex += encodeVarInt(scriptPubKey.length / 2);
          preimageHex += scriptPubKey;
        } else {
          // Other inputs - empty script
          preimageHex += '00';
        }

        preimageHex += reverseBytesInPairs((input.sequence ?? 0xffffffff).toString(16).padStart(8, '0'));
      }

      // Add outputs (from original unsigned tx)
      const outputPos = findOutputsPositionInHex(transactionHex, inputs.length);
      preimageHex += transactionHex.slice(outputPos);

      // Add SIGHASH_ALL to preimage (TETSUO specific - must be part of what's hashed)
      preimageHex += '01000000'; // SIGHASH_ALL in little-endian

      // Sign preimage
      const preimageBuffer = fromHex(preimageHex);
      const preimageHash = doubleSha256(preimageBuffer);

      const key = ec.keyFromPrivate(privateKey);
      const signature = key.sign(preimageHash);

      let rHex = signature.r.toString(16).padStart(64, '0');
      let sHex = signature.s.toString(16).padStart(64, '0');

      const derSig = encodeDERSignature(rHex, sHex) + '01'; // 01 = SIGHASH_ALL (part of scriptSig format)

      // Create scriptSig: <sig> <pubkey>
      const scriptSig = encodeVarInt(derSig.length / 2) + derSig +
                        encodeVarInt(pubKeyCompressed.length / 2) + pubKeyCompressed;

      scriptSigs.push(scriptSig);
    }

    // Rebuild complete transaction with all scriptSigs
    let signedHex = '01000000'; // Version
    signedHex += encodeVarInt(inputs.length);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      signedHex += reverseTxid(input.txid);
      signedHex += reverseBytesInPairs(input.vout.toString(16).padStart(8, '0'));
      signedHex += encodeVarInt(scriptSigs[i].length / 2) + scriptSigs[i];
      signedHex += reverseBytesInPairs((input.sequence ?? 0xffffffff).toString(16).padStart(8, '0'));
    }

    // Add outputs from original
    const outputPos = findOutputsPositionInHex(transactionHex, inputs.length);
    signedHex += transactionHex.slice(outputPos);

    return signedHex;

  } catch (error) {
    try {
      // Fallback: try simple signing
      const EC = require('elliptic').ec;
      const ec = new EC('secp256k1');

      const key = ec.keyFromPrivate(privateKey);
      const pubKeyUncompressed = key.getPublic('hex');
      const pubKeyCompressed = (parseInt(pubKeyUncompressed.slice(-2), 16) % 2 === 0 ? '02' : '03') +
                               pubKeyUncompressed.slice(0, 64);

      const txHash = doubleSha256(fromHex(transactionHex));
      const signature = key.sign(txHash);

      let rHex = signature.r.toString(16).padStart(64, '0');
      let sHex = signature.s.toString(16).padStart(64, '0');

      const derSig = encodeDERSignature(rHex, sHex) + '01';
      const scriptSig = encodeVarInt(derSig.length / 2) + derSig +
                        encodeVarInt(pubKeyCompressed.length / 2) + pubKeyCompressed;

      // Replace first input's script
      let pos = 8; // Skip version
      pos += 2;   // Skip input count
      pos += 64;  // Skip txid
      pos += 8;   // Skip vout

      const beforeScript = transactionHex.slice(0, pos);
      const afterScriptStart = pos + 2; // Skip "00"
      const afterScript = transactionHex.slice(afterScriptStart);

      return beforeScript + encodeVarInt(scriptSig.length / 2) + scriptSig + afterScript;

    } catch (error2) {
      console.error('Signing error:', (error as Error).message);
      return transactionHex;
    }
  }
}

/**
 * Find the character position where outputs start in transaction hex
 */
function findOutputsPositionInHex(transactionHex: string, inputCount: number): number {
  let pos = 0;

  // Skip version (4 bytes = 8 chars)
  pos += 8;

  // Skip input count varint
  if (transactionHex.slice(pos, pos + 2) < 'fd') {
    pos += 2; // 1 byte
  } else if (transactionHex.slice(pos, pos + 2) === 'fd') {
    pos += 6; // 1 + 2 bytes
  } else if (transactionHex.slice(pos, pos + 2) === 'fe') {
    pos += 10; // 1 + 4 bytes
  } else {
    pos += 18; // 1 + 8 bytes
  }

  // Skip inputs
  for (let i = 0; i < inputCount; i++) {
    pos += 64; // txid (32 bytes)
    pos += 8;  // vout (4 bytes)

    // Get script length
    const scriptLenHex = transactionHex.slice(pos, pos + 2);
    let scriptLen: number;

    if (parseInt(scriptLenHex, 16) < 0xfd) {
      scriptLen = parseInt(scriptLenHex, 16);
      pos += 2; // varint length
      pos += scriptLen * 2; // script bytes
    } else if (scriptLenHex === 'fd') {
      scriptLen = parseInt(transactionHex.slice(pos + 2, pos + 6), 16);
      pos += 6; // varint length
      pos += scriptLen * 2; // script bytes
    } else if (scriptLenHex === 'fe') {
      scriptLen = parseInt(transactionHex.slice(pos + 2, pos + 10), 16);
      pos += 10; // varint length
      pos += scriptLen * 2; // script bytes
    } else {
      scriptLen = parseInt(transactionHex.slice(pos + 2, pos + 18), 16);
      pos += 18; // varint length
      pos += scriptLen * 2; // script bytes
    }

    pos += 8; // sequence (4 bytes)
  }

  return pos;
}

/**
 * Encode signature as DER format with canonical S value
 */
function encodeDERSignature(rHex: string, sHex: string): string {
  // secp256k1 curve order
  const curveOrder = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141';

  // Check if S is in high form (> n/2) and convert to low form if needed
  const sValue = BigInt('0x' + sHex);
  const nValue = BigInt('0x' + curveOrder);
  const nHalf = nValue / 2n;

  if (sValue > nHalf) {
    const lowS = nValue - sValue;
    sHex = lowS.toString(16).toUpperCase().padStart(64, '0');
  }

  // Remove leading zeros for r
  rHex = rHex.replace(/^0+/, '');
  if (rHex.length % 2) rHex = '0' + rHex;
  if (parseInt(rHex.slice(0, 2), 16) > 0x7f) rHex = '00' + rHex;

  // Remove leading zeros for s
  sHex = sHex.replace(/^0+/, '');
  if (sHex.length % 2) sHex = '0' + sHex;
  if (parseInt(sHex.slice(0, 2), 16) > 0x7f) sHex = '00' + sHex;

  const rLen = (rHex.length / 2).toString(16).padStart(2, '0');
  const sLen = (sHex.length / 2).toString(16).padStart(2, '0');

  // Calculate total content length in bytes:
  // 02 + rLen + rHex + 02 + sLen + sHex
  // = (2 + 2 + 64 + 2 + 2 + 64) chars / 2 = 68 bytes
  const contentBytes = (2 + rLen.length + rHex.length + 2 + sLen.length + sHex.length) / 2;
  const contentLength = contentBytes.toString(16).padStart(2, '0');

  return '30' + contentLength +
         '02' + rLen + rHex +
         '02' + sLen + sHex;
}

/**
 * Find where outputs start in transaction buffer
 */
function findOutputsStart(buffer: Buffer, inputCount: number): number {
  let pos = 4; // Skip version

  // Skip input count varint
  if (buffer[pos] < 0xfd) pos += 1;
  else if (buffer[pos] === 0xfd) pos += 3;
  else if (buffer[pos] === 0xfe) pos += 5;
  else pos += 9;

  // Skip inputs
  for (let i = 0; i < inputCount; i++) {
    pos += 32; // txid
    pos += 4;  // vout

    // Skip script
    const scriptLen = buffer[pos];
    if (scriptLen < 0xfd) {
      pos += 1 + scriptLen;
    } else {
      pos += 1 + (scriptLen === 0xfd ? 2 : scriptLen === 0xfe ? 4 : 8) + buffer.readUInt32LE(pos + 1);
    }

    pos += 4; // sequence
  }

  return pos;
}

/**
 * Sign data with a private key using secp256k1
 */
function signWithPrivateKey(privateKey: string, data: Buffer): string {
  const EC = require('elliptic').ec;
  const ec = new EC('secp256k1');

  const key = ec.keyFromPrivate(privateKey);
  const signature = key.sign(data);

  // DER encode signature
  const r = signature.r.toString('hex').padStart(64, '0');
  const s = signature.s.toString('hex').padStart(64, '0');

  // Simple signature encoding
  const sig = r + s + '01'; // Add SIGHASH_ALL
  return sig;
}

/**
 * Encode variable length integer
 */
function encodeVarInt(num: number): string {
  if (num < 0xfd) {
    return num.toString(16).padStart(2, '0');
  } else if (num <= 0xffff) {
    return 'fd' + num.toString(16).padStart(4, '0');
  } else if (num <= 0xffffffff) {
    return 'fe' + num.toString(16).padStart(8, '0');
  } else {
    return 'ff' + num.toString(16).padStart(16, '0');
  }
}

/**
 * Create a pay-to-pubkey-hash script
 */
function createPayToPubKeyHashScript(hash160: Buffer): string {
  // OP_DUP OP_HASH160 <hash160> OP_EQUALVERIFY OP_CHECKSIG
  return '76' + 'a9' + '14' + hash160.toString('hex') + '88' + 'ac';
}

/**
 * Reverse transaction ID to little endian
 */
function reverseTxid(txid: string): string {
  const bytes = [];
  for (let i = 0; i < txid.length; i += 2) {
    bytes.push(txid.substr(i, 2));
  }
  return bytes.reverse().join('');
}

/**
 * Reverse bytes in pairs (for little endian conversion)
 */
function reverseBytesInPairs(hex: string): string {
  const pairs = [];
  for (let i = 0; i < hex.length; i += 2) {
    pairs.push(hex.substr(i, 2));
  }
  return pairs.reverse().join('');
}

/**
 * Calculate transaction size
 */
export function estimateTransactionSize(inputCount: number, outputCount: number): number {
  // Rough estimate: 148 bytes per input + 34 bytes per output + 10 bytes overhead
  return inputCount * 148 + outputCount * 34 + 10;
}

/**
 * Estimate transaction fee
 */
export function estimateFee(inputCount: number, outputCount: number): number {
  const size = estimateTransactionSize(inputCount, outputCount);
  return Math.max(MIN_FEE, Math.ceil(size / 1000) * FEE_PER_BYTE);
}
