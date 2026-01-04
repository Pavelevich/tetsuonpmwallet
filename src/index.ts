/**
 * TETSUO Wallet SDK - Main Entry Point
 */

// Type exports
export {
  WalletConfig,
  GeneratedWallet,
  ImportedWallet,
  UTXO,
  TransactionInput,
  TransactionOutput,
  SignedTransaction,
  TransactionResult,
  Balance,
  Transaction,
  BlockchainInfo,
  WalletError,
  InvalidAddressError,
  InsufficientFundsError,
  RPCError
} from './types';

// Crypto exports
export {
  sha256,
  doubleSha256,
  ripemd160,
  hash160,
  randomBytes,
  toHex,
  fromHex,
  toBase58,
  fromBase58,
  base58check,
  base58checkDecode
} from './crypto';

// Address exports
export {
  generateAddress,
  isValidAddress,
  validateAddress,
  addressToHash160,
  getAddressHash
} from './address';

// Wallet exports
export {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  derivePublicKey,
  derivePublicKeyLegacy,
  isValidMnemonic,
  getSupportedMnemonicLengths
} from './wallet';

// Transaction exports
export {
  buildTransaction,
  createTransactionHex,
  signTransaction,
  estimateTransactionSize,
  estimateFee
} from './transaction';

// RPC exports
export { TetsuoRPC, createRPCClient } from './rpc';

// Version
export const VERSION = '1.3.0';

// Package info
export const PACKAGE_INFO = {
  name: 'tetsuo-wallet-sdk',
  version: VERSION,
  description: 'TypeScript SDK for TETSUO blockchain wallet operations'
};
