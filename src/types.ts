/**
 * TETSUO Wallet SDK - Type Definitions
 */

export interface WalletConfig {
  networkUrl: string;
  addressPrefix?: number;
  derivationPath?: string;
}

export interface GeneratedWallet {
  mnemonic: string;
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface ImportedWallet {
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  confirmations: number;
  scriptPubKey?: string;
}

export interface TransactionInput {
  txid: string;
  vout: number;
  scriptSig?: string;
  sequence?: number;
}

export interface TransactionOutput {
  address: string;
  value: number;
}

export interface SignedTransaction {
  txHex: string;
  txid: string;
  size: number;
  fee: number;
}

export interface TransactionResult {
  txid: string;
  success: boolean;
  error?: string;
  confirmations?: number;
}

export interface Balance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export interface Transaction {
  txid: string;
  amount: number;
  isIncoming: boolean;
  confirmations: number;
  timestamp: number;
  address: string;
  fee?: number;
}

export interface BlockchainInfo {
  blockHeight: number;
  difficulty: number;
  networkName: string;
  isConnected: boolean;
}

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

export class InvalidAddressError extends WalletError {
  constructor(address: string) {
    super(`Invalid TETSUO address: ${address}`);
    this.name = 'InvalidAddressError';
  }
}

export class InsufficientFundsError extends WalletError {
  constructor(required: number, available: number) {
    super(`Insufficient funds. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

export class RPCError extends WalletError {
  constructor(message: string, public code?: number) {
    super(`RPC Error: ${message}`);
    this.name = 'RPCError';
  }
}
