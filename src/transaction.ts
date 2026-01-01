/**
 * TETSUO Wallet SDK - Transaction Building & Signing
 */

import { createHmac } from 'crypto';
import { doubleSha256, toHex, fromHex } from './crypto';
import { validateAddress, addressToHash160 } from './address';
import { SignedTransaction, TransactionInput, TransactionOutput, UTXO, InsufficientFundsError, WalletError } from './types';

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
    sequence: 0xfffffffe
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
  outputs: TransactionOutput[]
): string {
  let hex = '';

  // Version (4 bytes)
  hex += '01000000';

  // Input count (variable length int)
  hex += encodeVarInt(inputs.length);

  // Inputs
  for (const input of inputs) {
    // Previous transaction ID (little endian)
    hex += reverseTxid(input.txid);

    // Previous output index (4 bytes, little endian)
    hex += input.vout.toString(16).padStart(8, '0');

    // Script length and script (for unsigned, empty)
    hex += '00'; // 0 length script

    // Sequence
    hex += (input.sequence ?? 0xfffffffe).toString(16).padStart(8, '0');
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
 * Sign a transaction
 */
export function signTransaction(
  transactionHex: string,
  privateKey: string,
  inputs: TransactionInput[]
): string {
  // In production, use proper secp256k1 library for signing
  // For now, create a basic signature

  const txBuffer = fromHex(transactionHex);
  const txHash = doubleSha256(txBuffer);
  const signature = signWithPrivateKey(privateKey, txHash);

  return signature;
}

/**
 * Sign data with a private key (simplified)
 */
function signWithPrivateKey(privateKey: string, data: Buffer): string {
  const privateKeyBuffer = fromHex(privateKey);

  // HMAC-based signature (simplified, use proper secp256k1 in production)
  const hmac = createHmac('sha256', privateKeyBuffer);
  hmac.update(data);
  const signature = hmac.digest().toString('hex');

  // Add signature hash type (01 = SIGHASH_ALL)
  return signature + '01';
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
