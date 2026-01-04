# TETSUO Blockchain Wallet SDK

[![npm version](https://img.shields.io/npm/v/tetsuo-blockchain-wallet.svg)](https://www.npmjs.com/package/tetsuo-blockchain-wallet)
[![npm downloads](https://img.shields.io/npm/dm/tetsuo-blockchain-wallet.svg)](https://www.npmjs.com/package/tetsuo-blockchain-wallet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-tetsuonpmwallet-blue.svg)](https://github.com/Pavelevich/tetsuonpmwallet)

```
 ████████╗███████╗████████╗███████╗██╗   ██╗ ██████╗     ██╗    ██╗ █████╗ ██╗     ██╗     ███████╗████████╗
 ╚══██╔══╝██╔════╝╚══██╔══╝██╔════╝██║   ██║██╔═══██╗    ██║    ██║██╔══██╗██║     ██║     ██╔════╝╚══██╔══╝
    ██║   █████╗     ██║   ███████╗██║   ██║██║   ██║    ██║ █╗ ██║███████║██║     ██║     █████╗     ██║
    ██║   ██╔══╝     ██║   ╚════██║██║   ██║██║   ██║    ██║███╗██║██╔══██║██║     ██║     ██╔══╝     ██║
    ██║   ███████╗   ██║   ███████║╚██████╔╝╚██████╔╝    ╚███╔███╔╝██║  ██║███████╗███████╗███████╗   ██║
    ╚═╝   ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝  ╚═════╝      ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝
```

**Secure Blockchain Wallet • Client-Side Signing • Zero Trust Architecture**

A **production-ready** TypeScript SDK for building and managing TETSUO blockchain wallets. Provides secure wallet generation, transaction signing, and blockchain interaction with client-side signing for maximum security.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [API Reference](#api-reference)
- [Security](#security)
- [Examples](#examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

### 🔐 Wallet Management
- **BIP39 Mnemonics**: Generate 12-word recovery phrases for wallet backup
- **Multiple Import Methods**: Import from mnemonics or private keys
- **Secure Key Derivation**: Secp256k1 elliptic curve cryptography
- **Local Wallet Storage**: Encrypted wallet data at `~/.tetsuo/wallets.json`

### 💱 Transaction Operations
- **Client-Side Signing**: All transactions signed locally (never share private keys)
- **Automatic UTXO Selection**: Smart coin selection algorithm
- **Dynamic Fee Calculation**: Accurate fee estimation based on network
- **Transaction Building**: Complete transaction hex generation

### 📍 Address Management
- **TETSUO Address Generation**: From public keys with proper checksums
- **Address Validation**: Format and checksum verification
- **Hash160 Support**: Extract address information

### 🌐 Blockchain Interaction
- **RPC Client**: Full-featured network communication
- **Balance Queries**: Get balance in TETSUO
- **UTXO Fetching**: For transaction input selection
- **Transaction Broadcasting**: Publish signed transactions
- **Fee Estimation**: Network-based fee calculation

### 🔒 Cryptography
- **SHA256 & RIPEMD160**: Standard blockchain hashing
- **Base58Check Encoding**: Bitcoin-compatible address encoding
- **ECDSA Signing**: Secp256k1 signature generation
- **Secure Random**: Cryptographically secure key generation

## Installation

```bash
npm install -g tetsuo-blockchain-wallet
```

Or for programmatic use:

```bash
npm install tetsuo-blockchain-wallet
```

## Quick Start

### Interactive CLI (Easiest)

```bash
tetsuo
```

Then use commands like:
```
/create-wallet    - Create new wallet
/balance          - Check balance
/send             - Send TETSUO tokens
/list-wallets     - View all wallets
/exit             - Exit program
```

### Programmatic API

```typescript
import {
  generateWallet,
  createRPCClient,
  buildTransaction,
  signTransaction,
  createTransactionHex
} from 'tetsuo-blockchain-wallet';

// Create wallet
const wallet = await generateWallet();
console.log('Address:', wallet.address);
console.log('Backup mnemonic:', wallet.mnemonic);

// Get balance
const rpc = createRPCClient('https://tetsuoarena.com');
const balance = await rpc.getBalance(wallet.address);
console.log('Balance:', balance, 'TETSUO');

// Send transaction
const utxos = await rpc.getUTXOs(wallet.address);
const { inputs, outputs } = buildTransaction(
  wallet.address,
  'T1234567890abcdefghijklmnopqrstuvwxyz',
  1.5, // 1.5 TETSUO
  utxos,
  wallet.address
);

const txHex = createTransactionHex(inputs, outputs);
const signedTx = signTransaction(txHex, wallet.privateKey, inputs, utxos);
const txid = await rpc.broadcastTransaction(signedTx);
console.log('Sent! TXID:', txid);
```

## CLI Usage

### Start the CLI

```bash
tetsuo
```

### Available Commands

| Command | Description |
|---------|-------------|
| `/create-wallet` | Create new wallet with BIP39 mnemonic |
| `/import-wallet` | Import from existing mnemonic or private key |
| `/list-wallets` | Display all stored wallets |
| `/select-wallet` | Choose active wallet for operations |
| `/balance` | Check current wallet balance |
| `/transactions` | View transaction history |
| `/receive` | Display receiving address |
| `/send` | Send TETSUO to another address |
| `/wallet-data` | View detailed wallet information |
| `/delete-wallet` | Remove wallet from storage |
| `/config` | Configure RPC endpoint |
| `/set-password` | Enable wallet encryption |
| `/change-password` | Change encryption password |
| `/exit` | Quit the CLI |

### Example Workflow

```bash
$ tetsuo

[...] Generating wallet...
[OK] Wallet created successfully!
[NOTE] Mnemonic (BACKUP THIS):
word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

[ADDR] Address:
TAbcdefghijklmnopqrstuvwxyz1234567890

$ /balance
[...] Fetching balance...
[BALANCE] Balance Information:
──────────────────────────────────────────────────
  Wallet:  my-wallet
  Address: TAbcdefghijklmnopqrstuvwxyz1234567890
  Balance: 10.5 TETSUO
──────────────────────────────────────────────────

$ /send
Recipient address: T1111111111111111111111111111111111111111
Amount (TETSUO): 5

[...] Preparing transaction...
[HISTORY] Transaction Details:
────────────────────────────────────────────────────────────
  From:     TAbcdefghijklmnopqrstuvwxyz1234567890
  To:       T1111111111111111111111111111111111111111
  Amount:   5 TETSUO
  Fee:      0.00025 TETSUO
  Total:    5.00025 TETSUO
────────────────────────────────────────────────────────────

Confirm transaction? (yes/no): yes

[...] Signing transaction...
[OK] Transaction sent successfully!

[INFO] Transaction Info:
TXID: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...
```

### Configuration

```bash
# Custom RPC endpoint
export TETSUO_RPC_URL=https://your-rpc-server.com
tetsuo

# Default RPC (if not set)
# https://tetsuoarena.com
```

### Wallet Storage

Wallets are stored locally at:
```
~/.tetsuo/wallets.json
```

Each wallet contains:
- Name (user-defined)
- Address (TETSUO blockchain address)
- Public Key (compressed format)
- Private Key (hex format, handle with care!)
- Mnemonic (if wallet was generated)
- Creation timestamp

## API Reference

### Wallet Functions

#### `generateWallet(): Promise<Wallet>`
Generate new wallet with random BIP39 mnemonic.

```typescript
const wallet = await generateWallet();
// {
//   mnemonic: "word1 word2 ... word12",
//   privateKey: "abcd1234...",
//   publicKey: "02abcd1234...",
//   address: "TAbcdef..."
// }
```

#### `importFromMnemonic(mnemonic: string): Promise<Wallet>`
Import wallet from 12-word BIP39 mnemonic.

```typescript
const wallet = await importFromMnemonic(
  'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12'
);
```

#### `importFromPrivateKey(privateKey: string): Wallet`
Import wallet from 64-character hex private key.

```typescript
const wallet = importFromPrivateKey('abcd1234...0000');
```

#### `isValidMnemonic(mnemonic: string): boolean`
Validate BIP39 mnemonic phrase.

#### `derivePublicKey(privateKey: string): string`
Derive compressed public key from private key.

### Address Functions

#### `isValidAddress(address: string): boolean`
Check if TETSUO address format is valid.

#### `validateAddress(address: string): string`
Validate address or throw error.

#### `generateAddress(publicKey: string): string`
Generate TETSUO address from public key.

### Transaction Functions

#### `buildTransaction(fromAddr, toAddr, amount, utxos, changeAddr): TransactionData`
Build unsigned transaction with automatic UTXO selection.

```typescript
const txData = buildTransaction(
  'TFrom...',
  'TTo...',
  1.5,        // TETSUO amount
  utxos,
  'TChangeAddr...'
);
// Returns: { inputs, outputs, fee }
```

#### `createTransactionHex(inputs, outputs): string`
Create transaction hex from inputs and outputs.

#### `signTransaction(txHex, privateKey, inputs, utxos): string`
Sign transaction with private key. Returns signed transaction hex.

#### `estimateFee(inputCount, outputCount): number`
Estimate transaction fee in satoshis.

### RPC Client

#### `createRPCClient(url?: string): RPC`
Create RPC client instance.

```typescript
const rpc = createRPCClient('https://tetsuoarena.com');
```

#### `rpc.getBalance(address: string): Promise<number>`
Get balance in TETSUO.

#### `rpc.getUTXOs(address: string): Promise<UTXO[]>`
Get unspent transaction outputs for address.

#### `rpc.getTransactionHistory(address: string): Promise<Transaction[]>`
Get transaction history for address.

#### `rpc.broadcastTransaction(txHex: string): Promise<string>`
Broadcast signed transaction. Returns TXID.

#### `rpc.ping(): Promise<boolean>`
Health check for RPC endpoint.

## Security

### 🔒 Production-Grade Security

**Wallet Encryption (v1.3.0+)**
- AES-256-GCM encryption for wallet file at rest
- PBKDF2 key derivation (100,000 iterations)
- Password required to unlock wallet
- Passwords cleared from memory on exit

**Client-Side Signing**
- 100% client-side transaction signing
- Private keys NEVER leave your device
- No server-side signing fallback
- Broadcast-only network communication

**Input Validation**
- Address format validation
- Amount range validation (0 < amount <= 21M)
- Wallet name sanitization
- Private key format validation

**Cryptographic Standards**
- secp256k1 elliptic curve (same as Bitcoin)
- BIP39 mnemonic generation
- SHA256, RIPEMD160, Base58Check
- ECDSA DER signature encoding

**Best Practices**
```typescript
// ✓ GOOD: Small test transaction first
const testTx = buildTransaction(from, to, 0.01, utxos, from);

// ✓ GOOD: Verify amounts before signing
console.log('Sending:', amount, 'to:', toAddress);

// ✗ BAD: Never log private keys
console.log(wallet.privateKey); // DON'T DO THIS

// ✗ BAD: Never send to unverified addresses
const address = userInput; // Verify first!
```

**New Security Commands**
```
/set-password     - Enable wallet encryption
/change-password  - Change encryption password
```

## Examples

### Example 1: Create and Export Wallet

```typescript
import { generateWallet } from 'tetsuo-blockchain-wallet';

const wallet = await generateWallet();

console.log('📝 SAVE THIS MNEMONIC SECURELY:');
console.log(wallet.mnemonic);

console.log('Your Address:', wallet.address);
console.log('Share this address to receive TETSUO');
```

### Example 2: Check Balance

```typescript
import { createRPCClient } from 'tetsuo-blockchain-wallet';

const rpc = createRPCClient('https://tetsuoarena.com');
const balance = await rpc.getBalance('TYourAddressHere');
console.log(`Balance: ${balance} TETSUO`);
```

### Example 3: Send Transaction

```typescript
import {
  createRPCClient,
  buildTransaction,
  createTransactionHex,
  signTransaction,
  importFromMnemonic
} from 'tetsuo-blockchain-wallet';

// Import wallet
const mnemonic = 'word1 word2 ... word12';
const wallet = await importFromMnemonic(mnemonic);

// Setup
const rpc = createRPCClient('https://tetsuoarena.com');
const recipientAddress = 'TRecipientAddressHere';
const amountTetsuo = 2.5;

// Get UTXOs
const utxos = await rpc.getUTXOs(wallet.address);

// Build transaction
const { inputs, outputs, fee } = buildTransaction(
  wallet.address,
  recipientAddress,
  amountTetsuo,
  utxos,
  wallet.address // change address
);

// Sign and broadcast
const txHex = createTransactionHex(inputs, outputs);
const signedTx = signTransaction(txHex, wallet.privateKey, inputs, utxos);
const txid = await rpc.broadcastTransaction(signedTx);

console.log(`✓ Transaction sent!`);
console.log(`TXID: ${txid}`);
console.log(`Explorer: https://tetsuoarena.com/tx/${txid}`);
```

### Example 4: Error Handling

```typescript
import {
  InvalidAddressError,
  InsufficientFundsError,
  RPCError,
  WalletError
} from 'tetsuo-blockchain-wallet';

try {
  const wallet = await generateWallet();
  // ... transaction logic
} catch (error) {
  if (error instanceof InvalidAddressError) {
    console.error('Invalid recipient address');
  } else if (error instanceof InsufficientFundsError) {
    console.error('Not enough balance');
  } else if (error instanceof RPCError) {
    console.error('Network error:', error.message);
  } else if (error instanceof WalletError) {
    console.error('Wallet error:', error.message);
  }
}
```

## Development

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` directory.

### Tests

```bash
npm test
```

Run full test suite with Jest.

### Watch Mode

```bash
npm run dev
```

Auto-recompile TypeScript on file changes.

### Clean

```bash
npm run clean
```

Remove compiled files and coverage reports.

## Recent Updates

### Version 1.3.0 ✨ (Security Release)
- **AES-256-GCM Encryption**: Wallet file encrypted at rest with password protection
- **Password Protection**: Required password to access wallet (min 8 characters)
- **PBKDF2 Key Derivation**: 100,000 iterations for brute-force resistance
- **Memory Security**: Passwords cleared from memory on exit
- **Input Validation**: Strict validation for addresses, amounts, wallet names
- **Zero Vulnerabilities**: Removed unused dependencies with CVEs
- **100% Client-Side**: Private keys never leave your device

### Version 1.2.6
- **Security fix**: Removed server-side signing fallback
- **Amount formatting**: Standard crypto format (no trailing zeros, thousand separators)

### Version 1.2.5
- Minor bug fixes and improvements

### Version 1.2.4
- Fixed critical endianness bug in transaction encoding
- Professional CLI interface

### Version 1.2.3
- Client-side signing fully functional

### Version 1.2.2
- Secp256k1 key derivation improvements

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Requirements:
- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- All tests must pass

## Support

- **Issues**: [GitHub Issues](https://github.com/Pavelevich/tetsuonpmwallet/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Pavelevich/tetsuonpmwallet/discussions)

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided "as is" without warranty. The authors are not responsible for lost funds or security breaches. Always test with small amounts first and follow security best practices.

---

**Made with ❤️ for the TETSUO blockchain community**
