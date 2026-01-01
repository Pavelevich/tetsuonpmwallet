# TETSUO Wallet SDK

A comprehensive TypeScript SDK for creating and managing TETSUO blockchain wallets. This package provides tools for wallet generation, transaction building, signing, and blockchain interaction.

## Features

✅ **Wallet Management**
- Generate wallets with BIP39 mnemonics
- Import wallets from existing mnemonics or private keys
- Secure key derivation using PBKDF2
- Public key and address generation

✅ **Transaction Operations**
- Build unsigned transactions
- Select UTXOs automatically
- Calculate fees dynamically
- Create transaction hex payloads

✅ **Address Management**
- Generate TETSUO addresses from public keys
- Validate address format and checksums
- Extract address information

✅ **Blockchain Interaction**
- RPC client for network communication
- Get balance and transaction history
- Fetch UTXOs for address
- Broadcast signed transactions
- Estimate network fees

✅ **Cryptography**
- SHA256 and RIPEMD160 hashing
- Base58 and Base58Check encoding
- ECDSA signing with secp256k1
- Random key generation

## Installation

```bash
npm install tetsuo-blockchain-wallet
```

## Quick Start

### Generate a New Wallet

```typescript
import { generateWallet } from 'tetsuo-blockchain-wallet';

const wallet = await generateWallet();

console.log('Mnemonic:', wallet.mnemonic);
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

### Import Wallet from Mnemonic

```typescript
import { importFromMnemonic } from 'tetsuo-blockchain-wallet';

const mnemonic = 'word1 word2 word3 ... word12';
const wallet = await importFromMnemonic(mnemonic);

console.log('Address:', wallet.address);
```

### Import Wallet from Private Key

```typescript
import { importFromPrivateKey } from 'tetsuo-blockchain-wallet';

const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
const wallet = importFromPrivateKey(privateKey);

console.log('Address:', wallet.address);
```

### Get Balance

```typescript
import { createRPCClient } from 'tetsuo-blockchain-wallet';

const rpc = createRPCClient('http://localhost:8080');
const balance = await rpc.getBalance('TYourAddressHere');

console.log('Balance (TETSUO):', balance);
```

### Build and Sign Transaction

```typescript
import {
  buildTransaction,
  createTransactionHex,
  signTransaction,
  createRPCClient
} from 'tetsuo-blockchain-wallet';

const rpc = createRPCClient('http://localhost:8080');

// Get UTXOs
const utxos = await rpc.getUTXOs(fromAddress);

// Build transaction
const { inputs, outputs, fee } = buildTransaction(
  fromAddress,
  toAddress,
  0.5, // 0.5 TETSUO
  utxos,
  changeAddress
);

// Create transaction hex
const unsignedTx = createTransactionHex(inputs, outputs);

// Sign transaction
const signature = signTransaction(unsignedTx, privateKey, inputs);

// Broadcast
const txid = await rpc.broadcastTransaction(signature);
console.log('Transaction sent:', txid);
```

### Validate Address

```typescript
import { isValidAddress, validateAddress } from 'tetsuo-blockchain-wallet';

const address = 'TYourAddressHere';

// Check if valid
if (isValidAddress(address)) {
  console.log('Valid address');
}

// Or throw error if invalid
try {
  validateAddress(address);
} catch (error) {
  console.error('Invalid address');
}
```

## API Reference

### Wallet Functions

#### `generateWallet(): Promise<GeneratedWallet>`
Generate a new wallet with a random mnemonic.

**Returns:**
```typescript
{
  mnemonic: string;        // 12-word BIP39 phrase
  privateKey: string;      // 64-char hex string
  publicKey: string;       // Compressed public key
  address: string;         // TETSUO address
}
```

#### `importFromMnemonic(mnemonic: string): Promise<GeneratedWallet>`
Import wallet from existing mnemonic phrase.

**Throws:** `WalletError` if mnemonic is invalid.

#### `importFromPrivateKey(privateKeyHex: string): ImportedWallet`
Import wallet from private key.

**Parameters:**
- `privateKeyHex`: 64-character hex string (32 bytes)

**Throws:** `WalletError` if private key is invalid.

#### `derivePublicKey(privateKeyHex: string): string`
Derive public key from private key.

#### `isValidMnemonic(mnemonic: string): boolean`
Validate a BIP39 mnemonic phrase.

### Address Functions

#### `generateAddress(publicKeyHex: string): string`
Generate TETSUO address from public key.

#### `isValidAddress(address: string): boolean`
Check if address format is valid.

#### `validateAddress(address: string): string`
Validate address and throw error if invalid.

**Throws:** `InvalidAddressError` if address is invalid.

#### `addressToHash160(address: string): Buffer`
Extract HASH160 from address.

### Transaction Functions

#### `buildTransaction(fromAddress, toAddress, amount, utxos, changeAddress): TransactionData`
Build unsigned transaction.

**Parameters:**
- `fromAddress`: Sender's TETSUO address
- `toAddress`: Recipient's TETSUO address
- `amount`: Amount in TETSUO (decimal)
- `utxos`: Array of available UTXOs
- `changeAddress`: Address for change output

**Returns:**
```typescript
{
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  fee: number; // in satoshis
}
```

**Throws:** `InsufficientFundsError` if not enough balance.

#### `createTransactionHex(inputs, outputs): string`
Create transaction hex from inputs and outputs.

#### `signTransaction(txHex, privateKey, inputs): string`
Sign transaction and return signed hex.

#### `estimateFee(inputCount, outputCount): number`
Estimate transaction fee (in satoshis).

#### `estimateTransactionSize(inputCount, outputCount): number`
Estimate transaction size (in bytes).

### RPC Client

#### `createRPCClient(networkUrl?: string): TetsuoRPC`
Create RPC client instance.

**Parameters:**
- `networkUrl`: Optional, defaults to `http://localhost:8080`

#### `rpc.getBalance(address: string): Promise<number>`
Get balance in TETSUO.

#### `rpc.getDetailedBalance(address: string): Promise<Balance>`
Get balance with confirmed/unconfirmed breakdown.

#### `rpc.getUTXOs(address: string): Promise<UTXO[]>`
Get list of unspent transaction outputs.

#### `rpc.getTransactionHistory(address: string): Promise<Transaction[]>`
Get transaction history for address.

#### `rpc.broadcastTransaction(transactionHex: string): Promise<string>`
Broadcast signed transaction. Returns transaction ID.

#### `rpc.getBlockchainInfo(): Promise<BlockchainInfo>`
Get blockchain information.

#### `rpc.estimateFee(inputCount, outputCount): Promise<number>`
Estimate network fee.

#### `rpc.validateAddress(address: string): Promise<boolean>`
Check if address is valid on network.

#### `rpc.ping(): Promise<boolean>`
Health check for RPC endpoint.

### Crypto Functions

#### `sha256(data: string | Buffer): Buffer`
Compute SHA256 hash.

#### `doubleSha256(data: string | Buffer): Buffer`
Compute double SHA256 (SHA256(SHA256(data))).

#### `ripemd160(data: Buffer): Buffer`
Compute RIPEMD160 hash.

#### `hash160(data: Buffer): Buffer`
Compute HASH160 (RIPEMD160(SHA256(data))).

#### `toHex(data: Buffer | string): string`
Convert buffer or string to hex.

#### `fromHex(hex: string): Buffer`
Convert hex string to buffer.

#### `toBase58(buffer: Buffer): string`
Encode buffer to base58.

#### `fromBase58(str: string): Buffer`
Decode base58 string to buffer.

#### `base58check(data: Buffer): string`
Encode with base58check (base58 + checksum).

#### `base58checkDecode(encoded: string): Buffer`
Decode base58check string.

## Error Handling

The SDK provides custom error classes:

```typescript
import {
  WalletError,
  InvalidAddressError,
  InsufficientFundsError,
  RPCError
} from 'tetsuo-blockchain-wallet';

try {
  // ... wallet operations
} catch (error) {
  if (error instanceof InvalidAddressError) {
    console.error('Invalid address format');
  } else if (error instanceof InsufficientFundsError) {
    console.error('Not enough balance to send transaction');
  } else if (error instanceof RPCError) {
    console.error('Network error:', error.message);
  } else if (error instanceof WalletError) {
    console.error('Wallet operation failed:', error.message);
  }
}
```

## Security Considerations

⚠️ **Important Security Notes:**

1. **Private Keys**: Never share your private keys. They are equivalent to your money.
2. **Mnemonics**: Backup your mnemonic phrase offline. Whoever has your mnemonic can access all funds.
3. **Network**: Always use HTTPS for RPC connections in production.
4. **Validation**: Always validate addresses before sending transactions.
5. **Testing**: Test with small amounts first before sending large transactions.

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run dev
```

## Contributing

Contributions are welcome! Please ensure:
- Code follows TypeScript best practices
- All tests pass
- New features include tests
- Documentation is updated

## License

MIT

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Changelog

### Version 1.0.0
- Initial release
- Wallet generation and import
- Transaction building and signing
- Address validation and generation
- RPC client for blockchain interaction
- Comprehensive test suite
