#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as crypto from 'crypto';
import {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  isValidAddress,
  createRPCClient,
  isValidMnemonic,
  buildTransaction,
  createTransactionHex,
  signTransaction
} from './index';
import chalk from 'chalk';
import axios from 'axios';

// Dexscreener API for TETSUO price
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/pairs/solana/2KB3i5uLKhUcjUwq3poxHpuGGqBWYwtTk5eG9E5WnLG6';

// Encryption constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Types
interface StoredWallet {
  name: string;
  address: string;
  privateKey: string;
  publicKey: string;
  mnemonic?: string;
  createdAt: string;
}

interface WalletStore {
  wallets: StoredWallet[];
  selectedWallet?: string;
}

interface Config {
  rpcUrl: string;
}

// Constants
const WALLET_DIR = path.join(process.env.HOME || '~', '.tetsuo');
const WALLET_FILE = path.join(WALLET_DIR, 'wallets.json');
const CONFIG_FILE = path.join(WALLET_DIR, 'config.json');
let RPC_URL = process.env.TETSUO_RPC_URL || 'https://tetsuoarena.com';

// Fetch TETSUO price from Solana dexscreener
async function fetchTetsuoPrice(): Promise<void> {
  try {
    const response = await axios.get(DEXSCREENER_API, { timeout: 5000 });
    const pair = response.data?.pair;

    if (pair) {
      const price = parseFloat(pair.priceUsd || 0);
      const change24h = parseFloat(pair.priceChange?.h24 || 0);
      const volume24h = parseFloat(pair.volume?.h24 || 0);
      const liquidity = parseFloat(pair.liquidity?.usd || 0);

      const changeColor = change24h >= 0 ? chalk.green : chalk.red;
      const changeSign = change24h >= 0 ? '+' : '';

      console.log(chalk.cyan('─'.repeat(60)));
      console.log(chalk.cyan.bold('  TETSUO/SOL (Solana) - Live Price'));
      console.log(chalk.cyan('─'.repeat(60)));
      console.log(chalk.yellow('  Price:      ') + chalk.white(`$${price.toFixed(6)}`));
      console.log(chalk.yellow('  24h Change: ') + changeColor(`${changeSign}${change24h.toFixed(2)}%`));
      console.log(chalk.yellow('  24h Volume: ') + chalk.white(`$${formatAmount(volume24h)}`));
      console.log(chalk.yellow('  Liquidity:  ') + chalk.white(`$${formatAmount(liquidity)}`));
      console.log(chalk.gray('  Source: dexscreener.com/solana/tetsuo'));
      console.log(chalk.cyan('─'.repeat(60)));
    }
  } catch (error) {
    // Silently fail - price display is optional
    console.log(chalk.gray('  [Price data unavailable]'));
  }
}

// Format amount in standard crypto format (removes trailing zeros, adds thousand separators)
function formatAmount(value: number): string {
  if (value === 0) return '0';
  let formatted = value.toFixed(8);
  // Remove trailing zeros after decimal
  formatted = formatted.replace(/\.?0+$/, '');
  // Add thousand separators
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? parts.join('.') : parts[0];
}

// Derive encryption key from password using PBKDF2
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
}

// Encrypt data with AES-256-GCM
function encryptData(data: string, password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:encryptedData (all hex)
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

// Decrypt data with AES-256-GCM
function decryptData(encryptedData: string, password: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Check if wallet file is encrypted
function isWalletEncrypted(): boolean {
  if (!fs.existsSync(WALLET_FILE)) return false;
  const data = fs.readFileSync(WALLET_FILE, 'utf-8');
  // Encrypted format has colons separating salt:iv:authTag:data
  return data.includes(':') && !data.startsWith('{');
}

// Session password (cleared on exit)
let sessionPassword: string | null = null;

// Securely clear password from memory
function clearPassword(): void {
  if (sessionPassword) {
    // Overwrite with random data before clearing
    const len = sessionPassword.length;
    sessionPassword = crypto.randomBytes(len).toString('hex').slice(0, len);
    sessionPassword = null;
  }
}

// Load config from storage
function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Fall back to defaults
  }
  return { rpcUrl: RPC_URL };
}

// Save config to storage
function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Ensure wallet directory exists
function initWalletStorage() {
  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { recursive: true });
  }
  if (!fs.existsSync(WALLET_FILE)) {
    fs.writeFileSync(WALLET_FILE, JSON.stringify({ wallets: [] }, null, 2));
  }

  // Load config and update RPC_URL
  const config = loadConfig();
  RPC_URL = config.rpcUrl;
}

// Load wallets from storage (with decryption)
function loadWallets(): WalletStore {
  try {
    if (!fs.existsSync(WALLET_FILE)) {
      return { wallets: [] };
    }

    const data = fs.readFileSync(WALLET_FILE, 'utf-8');

    // Check if encrypted
    if (isWalletEncrypted()) {
      if (!sessionPassword) {
        throw new Error('Wallet is locked. Please unlock first.');
      }
      const decrypted = decryptData(data, sessionPassword);
      return JSON.parse(decrypted);
    }

    return JSON.parse(data);
  } catch (error: any) {
    if (error.message.includes('Unsupported state') || error.message.includes('bad decrypt')) {
      throw new Error('Invalid password');
    }
    throw error;
  }
}

// Save wallets to storage (with encryption)
function saveWallets(store: WalletStore) {
  const data = JSON.stringify(store, null, 2);

  if (sessionPassword) {
    const encrypted = encryptData(data, sessionPassword);
    fs.writeFileSync(WALLET_FILE, encrypted);
  } else {
    fs.writeFileSync(WALLET_FILE, data);
  }
}

// CLI Commands
async function createWallet(rl: readline.Interface): Promise<void> {
  const name = await question(rl, 'Wallet name: ');
  const trimmedName = name.trim();

  // Validate wallet name
  if (!trimmedName) {
    console.log(chalk.red('[ERROR] Wallet name cannot be empty'));
    return;
  }
  if (trimmedName.length > 50) {
    console.log(chalk.red('[ERROR] Wallet name too long (max 50 characters)'));
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    console.log(chalk.red('[ERROR] Wallet name can only contain letters, numbers, underscores, and hyphens'));
    return;
  }

  try {
    console.log(chalk.yellow('[...] Generating wallet...'));
    const wallet = await generateWallet();

    const store = loadWallets();
    const exists = store.wallets.some(w => w.name === trimmedName);
    if (exists) {
      console.log(chalk.red('[ERROR] Wallet with this name already exists'));
      return;
    }

    store.wallets.push({
      name: trimmedName,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic,
      createdAt: new Date().toISOString()
    });

    if (!store.selectedWallet) {
      store.selectedWallet = trimmedName;
    }

    saveWallets(store);

    console.log(chalk.green('[OK] Wallet created successfully!'));
    console.log(chalk.cyan('\n[NOTE] Mnemonic (BACKUP THIS):'));
    console.log(chalk.yellow(wallet.mnemonic));
    console.log(chalk.cyan('\n[ADDR] Address:'));
    console.log(chalk.yellow(wallet.address));
  } catch (error: any) {
    console.log(chalk.red(`[ERROR] Error: ${error.message}`));
  }
}

async function importWallet(rl: readline.Interface): Promise<void> {
  const name = await question(rl, 'Wallet name: ');
  const trimmedName = name.trim();

  // Validate wallet name
  if (!trimmedName) {
    console.log(chalk.red('[ERROR] Wallet name cannot be empty'));
    return;
  }
  if (trimmedName.length > 50) {
    console.log(chalk.red('[ERROR] Wallet name too long (max 50 characters)'));
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    console.log(chalk.red('[ERROR] Wallet name can only contain letters, numbers, underscores, and hyphens'));
    return;
  }

  const type = await question(rl, 'Import from (mnemonic/privatekey): ');

  try {
    let wallet;

    if (type.toLowerCase() === 'mnemonic') {
      const mnemonic = await question(rl, 'Enter mnemonic (12 words): ');
      if (!isValidMnemonic(mnemonic)) {
        console.log(chalk.red('[ERROR] Invalid mnemonic'));
        return;
      }
      console.log(chalk.yellow('[...] Importing wallet...'));
      wallet = await importFromMnemonic(mnemonic);
    } else if (type.toLowerCase() === 'privatekey') {
      const privateKey = await question(rl, 'Enter private key (hex): ');
      // Validate private key format
      if (!/^[a-fA-F0-9]{64}$/.test(privateKey)) {
        console.log(chalk.red('[ERROR] Invalid private key - must be 64 hex characters'));
        return;
      }
      console.log(chalk.yellow('[...] Importing wallet...'));
      wallet = importFromPrivateKey(privateKey);
    } else {
      console.log(chalk.red('[ERROR] Invalid import type. Use "mnemonic" or "privatekey"'));
      return;
    }

    const store = loadWallets();
    const exists = store.wallets.some(w => w.name === trimmedName);
    if (exists) {
      console.log(chalk.red('[ERROR] Wallet with this name already exists'));
      return;
    }

    store.wallets.push({
      name: trimmedName,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: (wallet as any).mnemonic,
      createdAt: new Date().toISOString()
    });

    if (!store.selectedWallet) {
      store.selectedWallet = trimmedName;
    }

    saveWallets(store);
    console.log(chalk.green('[OK] Wallet imported successfully!'));
    console.log(chalk.cyan('[ADDR] Address:'));
    console.log(chalk.yellow(wallet.address));
  } catch (error: any) {
    console.log(chalk.red(`[ERROR] Error: ${error.message}`));
  }
}

async function listWallets(): Promise<void> {
  const store = loadWallets();

  if (store.wallets.length === 0) {
    console.log(chalk.yellow('No wallets found. Create one first!'));
    return;
  }

  console.log(chalk.cyan('\n[INFO] Your Wallets:'));
  console.log('─'.repeat(80));

  store.wallets.forEach((wallet, index) => {
    const selected = store.selectedWallet === wallet.name ? ' [SELECTED]' : '';
    const created = new Date(wallet.createdAt).toLocaleDateString();
    console.log(
      `${index + 1}. ${chalk.bold(wallet.name)}${selected}`
    );
    console.log(`   Address: ${chalk.green(wallet.address)}`);
    console.log(`   Created: ${created}`);
  });
  console.log('─'.repeat(80));
}

async function selectWallet(rl: readline.Interface): Promise<void> {
  const store = loadWallets();

  if (store.wallets.length === 0) {
    console.log(chalk.yellow('No wallets found'));
    return;
  }

  console.log(chalk.cyan('\nAvailable wallets:'));
  store.wallets.forEach((w, i) => console.log(`${i + 1}. ${w.name}`));

  const choice = await question(rl, 'Select wallet (number): ');
  const index = parseInt(choice) - 1;

  if (index >= 0 && index < store.wallets.length) {
    store.selectedWallet = store.wallets[index].name;
    saveWallets(store);
    console.log(chalk.green(`[OK] Selected: ${store.wallets[index].name}`));
  } else {
    console.log(chalk.red('[ERROR] Invalid selection'));
  }
}

async function getBalance(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('[ERROR] No wallet selected'));
    return;
  }

  try {
    console.log(chalk.yellow('[...] Fetching balance...'));
    const rpc = createRPCClient(RPC_URL);
    const balance = await rpc.getBalance(wallet.address);

    console.log(chalk.cyan('\n[BALANCE] Balance Information:'));
    console.log('─'.repeat(50));
    console.log(chalk.yellow('  Wallet:  ') + chalk.white(wallet.name));
    console.log(chalk.yellow('  Address: ') + chalk.white(wallet.address));
    console.log(chalk.yellow('  Balance: ') + chalk.green(`${formatAmount(balance)} TETSUO`));
    console.log('─'.repeat(50));
  } catch (error: any) {
    console.log(chalk.red(`[ERROR] Error: ${error.message}`));
  }
}

async function getTransactions(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('[ERROR] No wallet selected'));
    return;
  }

  try {
    console.log(chalk.yellow('[...] Fetching transactions...'));
    const rpc = createRPCClient(RPC_URL);
    const transactions = await rpc.getTransactionHistory(wallet.address);

    if (transactions.length === 0) {
      console.log(chalk.cyan('\n[HISTORY] Transaction History:'));
      console.log(chalk.yellow('  Wallet: ') + wallet.name);
      console.log(chalk.yellow('No transactions found'));
      return;
    }

    console.log(chalk.cyan('\n[HISTORY] Transaction History:'));
    console.log(chalk.yellow('  Wallet: ') + wallet.name);
    console.log('─'.repeat(80));

    transactions.forEach((tx: any) => {
      const type = tx.isIncoming ? chalk.green('↓ RECEIVE') : chalk.yellow('↑ SEND');
      const date = new Date(tx.timestamp).toLocaleDateString();
      const feeStr = tx.fee ? ` | Fee: ${tx.fee}` : '';
      console.log(`${type} | ${formatAmount(tx.amount)} TETSUO | Confirmations: ${tx.confirmations}${feeStr} | ${date}`);
    });
    console.log('─'.repeat(80));
  } catch (error: any) {
    console.log(chalk.red(`[ERROR] Error: ${error.message}`));
  }
}

async function receiveTokens(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('[ERROR] No wallet selected'));
    return;
  }

  console.log(chalk.cyan('\n[ADDR] Receive Address:'));
  console.log(chalk.green(wallet.address));
  console.log(chalk.yellow('\nShare this address to receive TETSUO'));
}

async function sendTokens(rl: readline.Interface): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('[ERROR] No wallet selected'));
    return;
  }

  const toAddress = await question(rl, 'Recipient address: ');
  if (!isValidAddress(toAddress)) {
    console.log(chalk.red('[ERROR] Invalid recipient address'));
    return;
  }

  const amount = await question(rl, 'Amount (TETSUO): ');
  const numAmount = parseFloat(amount);

  // Validate amount
  if (isNaN(numAmount)) {
    console.log(chalk.red('[ERROR] Invalid amount - must be a number'));
    return;
  }
  if (numAmount <= 0) {
    console.log(chalk.red('[ERROR] Amount must be greater than 0'));
    return;
  }
  if (numAmount > 21_000_000) {
    console.log(chalk.red('[ERROR] Amount exceeds maximum (21,000,000 TETSUO)'));
    return;
  }
  // Check for too many decimal places (max 8)
  const decimalPlaces = (amount.split('.')[1] || '').length;
  if (decimalPlaces > 8) {
    console.log(chalk.red('[ERROR] Maximum 8 decimal places allowed'));
    return;
  }
  // Prevent sending to self
  if (toAddress === wallet.address) {
    console.log(chalk.red('[ERROR] Cannot send to yourself'));
    return;
  }

  try {
    console.log(chalk.yellow('\n[...] Preparing transaction...'));
    const rpc = createRPCClient(RPC_URL);

    // Get UTXOs
    console.log(chalk.yellow('  Fetching UTXOs...'));
    const utxos = await rpc.getUTXOs(wallet.address);

    if (utxos.length === 0) {
      console.log(chalk.red('[ERROR] No UTXOs available to spend'));
      return;
    }

    // Build transaction
    const txData = buildTransaction(wallet.address, toAddress, numAmount, utxos, wallet.address);

    // Show transaction details
    console.log(chalk.cyan('\n[HISTORY] Transaction Details:'));
    console.log('─'.repeat(60));
    console.log(chalk.yellow('  From:     ') + wallet.address);
    console.log(chalk.yellow('  To:       ') + toAddress);
    console.log(chalk.yellow('  Amount:   ') + chalk.green(formatAmount(numAmount) + ' TETSUO'));
    console.log(chalk.yellow('  Fee:      ') + chalk.yellow(formatAmount(txData.fee / 100_000_000) + ' TETSUO'));
    console.log(chalk.yellow('  Total:    ') + chalk.cyan(formatAmount(numAmount + txData.fee / 100_000_000) + ' TETSUO'));
    console.log('─'.repeat(60));

    // Ask for confirmation
    const confirm = await question(rl, chalk.cyan('\nConfirm transaction? (yes/no): '));
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log(chalk.yellow('[CANCEL] Transaction cancelled'));
      return;
    }

    // Create and sign transaction
    console.log(chalk.yellow('\n[...] Signing transaction...'));
    const txHex = createTransactionHex(txData.inputs, txData.outputs);
    const signedTxHex = signTransaction(txHex, wallet.privateKey, txData.inputs, utxos);

    // Broadcast signed transaction (client-side only - private key never leaves device)
    console.log(chalk.yellow('  Broadcasting...'));
    const txid = await rpc.broadcastTransaction(signedTxHex);

    console.log(chalk.green('\n[OK] Transaction sent successfully!'));
    console.log(chalk.cyan('\n[INFO] Transaction Info:'));
    console.log('─'.repeat(60));
    console.log(chalk.yellow('  TXID:     ') + chalk.green(txid));
    console.log(chalk.yellow('  Amount:   ') + chalk.green(formatAmount(numAmount) + ' TETSUO'));
    console.log(chalk.yellow('  Fee:      ') + chalk.yellow(formatAmount(txData.fee / 100_000_000) + ' TETSUO'));
    console.log('─'.repeat(60));
    console.log(chalk.cyan('\nCheck transaction status at: https://tetsuoarena.com/tx/' + txid));
  } catch (error: any) {
    console.log(chalk.red('\n[ERROR] Error: ' + error.message));
  }
}

async function walletData(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('[ERROR] No wallet selected'));
    return;
  }

  console.log(chalk.cyan('\n[INFO] Wallet Data:'));
  console.log('─'.repeat(80));
  console.log(`Name:       ${chalk.yellow(wallet.name)}`);
  console.log(`Address:    ${chalk.green(wallet.address)}`);
  console.log(`Public Key: ${chalk.blue(wallet.publicKey)}`);
  console.log(`Created:    ${new Date(wallet.createdAt).toLocaleString()}`);
  if (wallet.mnemonic) {
    console.log(chalk.yellow('\nMnemonic (keep safe):'));
    console.log(chalk.red(wallet.mnemonic));
  }
  console.log('─'.repeat(80));
}

async function deleteWallet(rl: readline.Interface): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('[ERROR] No wallet selected'));
    return;
  }

  const confirm = await question(rl, `Delete ${wallet.name}? (yes/no): `);
  if (confirm.toLowerCase() !== 'yes') {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  store.wallets = store.wallets.filter(w => w.name !== wallet.name);
  if (store.selectedWallet === wallet.name) {
    store.selectedWallet = store.wallets[0]?.name;
  }

  saveWallets(store);
  console.log(chalk.green('[OK] Wallet deleted'));
}

async function configureRPC(rl: readline.Interface): Promise<void> {
  const config = loadConfig();

  console.log(chalk.cyan('\n[CONFIG]  RPC Configuration:'));
  console.log(`Current RPC URL: ${chalk.green(RPC_URL)}`);

  const newUrl = await question(rl, 'Enter new RPC URL (or press Enter to keep current): ');

  if (newUrl.trim()) {
    RPC_URL = newUrl.trim();
    saveConfig({ rpcUrl: RPC_URL });
    console.log(chalk.green('[OK] RPC URL updated!'));
    console.log(`New URL: ${chalk.green(RPC_URL)}`);
  } else {
    console.log(chalk.yellow('No changes made'));
  }
}

// Helper to get user input
function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(chalk.cyan(prompt), resolve);
  });
}

// Helper for hidden password input
function questionPassword(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(chalk.cyan(prompt));

    const password: string[] = [];
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char: string) => {
      if (char === '\n' || char === '\r') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password.join(''));
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit();
      } else if (char === '\u007F' || char === '\b') {
        // Backspace
        if (password.length > 0) {
          password.pop();
          stdout.write('\b \b');
        }
      } else {
        password.push(char);
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

// Setup password for wallet encryption
async function setupPassword(rl: readline.Interface): Promise<boolean> {
  console.log(chalk.cyan('\n[SECURITY] Set up wallet encryption password'));
  console.log(chalk.yellow('This password protects your private keys. Do not forget it!'));
  console.log(chalk.yellow('Minimum 8 characters required.\n'));

  const password = await questionPassword(rl, 'Enter new password: ');

  if (password.length < 8) {
    console.log(chalk.red('[ERROR] Password must be at least 8 characters'));
    return false;
  }

  const confirm = await questionPassword(rl, 'Confirm password: ');

  if (password !== confirm) {
    console.log(chalk.red('[ERROR] Passwords do not match'));
    return false;
  }

  sessionPassword = password;

  // Re-save wallets with encryption
  const store = loadWallets();
  saveWallets(store);

  console.log(chalk.green('\n[OK] Wallet encryption enabled!'));
  return true;
}

// Unlock wallet with password
async function unlockWallet(rl: readline.Interface): Promise<boolean> {
  console.log(chalk.cyan('\n[LOCKED] Wallet is encrypted'));

  for (let attempts = 0; attempts < 3; attempts++) {
    const password = await questionPassword(rl, 'Enter password: ');

    try {
      sessionPassword = password;
      loadWallets(); // Test if password works
      console.log(chalk.green('[OK] Wallet unlocked!\n'));
      return true;
    } catch (error: any) {
      sessionPassword = null;
      console.log(chalk.red(`[ERROR] ${error.message}. Attempts remaining: ${2 - attempts}`));
    }
  }

  console.log(chalk.red('\n[ERROR] Too many failed attempts. Exiting.'));
  return false;
}

// Change wallet password
async function changePassword(rl: readline.Interface): Promise<void> {
  if (!sessionPassword) {
    console.log(chalk.red('[ERROR] Wallet not encrypted or not unlocked'));
    return;
  }

  const currentPassword = await questionPassword(rl, 'Enter current password: ');

  if (currentPassword !== sessionPassword) {
    console.log(chalk.red('[ERROR] Current password is incorrect'));
    return;
  }

  const newPassword = await questionPassword(rl, 'Enter new password: ');

  if (newPassword.length < 8) {
    console.log(chalk.red('[ERROR] Password must be at least 8 characters'));
    return;
  }

  const confirm = await questionPassword(rl, 'Confirm new password: ');

  if (newPassword !== confirm) {
    console.log(chalk.red('[ERROR] Passwords do not match'));
    return;
  }

  // Load with old password, save with new
  const store = loadWallets();
  sessionPassword = newPassword;
  saveWallets(store);

  console.log(chalk.green('[OK] Password changed successfully!'));
}

// Main CLI Loop
async function main() {
  initWalletStorage();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    clearPassword();
    console.log(chalk.green('\n\nGoodbye! [BYE]\n'));
    process.exit(0);
  });

  console.clear();
  console.log(chalk.cyan.bold(`
 ████████╗███████╗████████╗███████╗██╗   ██╗ ██████╗     ██╗    ██╗ █████╗ ██╗     ██╗     ███████╗████████╗
 ╚══██╔══╝██╔════╝╚══██╔══╝██╔════╝██║   ██║██╔═══██╗    ██║    ██║██╔══██╗██║     ██║     ██╔════╝╚══██╔══╝
    ██║   █████╗     ██║   ███████╗██║   ██║██║   ██║    ██║ █╗ ██║███████║██║     ██║     █████╗     ██║
    ██║   ██╔══╝     ██║   ╚════██║██║   ██║██║   ██║    ██║███╗██║██╔══██║██║     ██║     ██╔══╝     ██║
    ██║   ███████╗   ██║   ███████║╚██████╔╝╚██████╔╝    ╚███╔███╔╝██║  ██║███████╗███████╗███████╗   ██║
    ╚═╝   ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝  ╚═════╝      ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝
  `));
  console.log(chalk.gray('          Secure Blockchain Wallet • Client-Side Signing • AES-256 Encrypted\n'));

  // Show live TETSUO price from Solana
  await fetchTetsuoPrice();
  console.log('');

  // Handle wallet encryption
  if (isWalletEncrypted()) {
    // Wallet is encrypted, need to unlock
    const unlocked = await unlockWallet(rl);
    if (!unlocked) {
      rl.close();
      process.exit(1);
    }
  } else {
    // Check if there are existing wallets that need encryption
    try {
      const store = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf-8'));
      if (store.wallets && store.wallets.length > 0) {
        console.log(chalk.yellow('[WARNING] Your wallet is not encrypted!'));
        const encrypt = await question(rl, 'Would you like to set up encryption now? (yes/no): ');
        if (encrypt.toLowerCase() === 'yes' || encrypt.toLowerCase() === 'y') {
          const success = await setupPassword(rl);
          if (!success) {
            console.log(chalk.yellow('Continuing without encryption...'));
          }
        }
      }
    } catch {
      // No wallets yet, that's fine
    }
  }

  let running = true;

  while (running) {
    const store = loadWallets();
    const selected = store.selectedWallet
      ? chalk.green(`[${store.selectedWallet}]`)
      : chalk.red('[No Wallet Selected]');

    console.log(`\n${selected} Commands:`);
    console.log('/create-wallet    - Create new wallet');
    console.log('/import-wallet    - Import from mnemonic or private key');
    console.log('/list-wallets     - Show all wallets');
    console.log('/select-wallet    - Select active wallet');
    console.log('/balance          - Check balance');
    console.log('/transactions     - View transaction history');
    console.log('/receive          - Show receive address');
    console.log('/send             - Send tokens');
    console.log('/wallet-data      - View wallet details');
    console.log('/delete-wallet    - Delete wallet');
    console.log('/config           - Configure RPC URL');
    console.log('/set-password     - Enable wallet encryption');
    console.log('/change-password  - Change encryption password');
    console.log('/price            - Show TETSUO price (Solana)');
    console.log('/exit             - Exit CLI\n');

    const input = await question(rl, 'Command: ');
    const command = input.toLowerCase().trim();

    switch (command) {
      case '/create-wallet':
        await createWallet(rl);
        break;
      case '/import-wallet':
        await importWallet(rl);
        break;
      case '/list-wallets':
        await listWallets();
        break;
      case '/select-wallet':
        await selectWallet(rl);
        break;
      case '/balance':
        await getBalance();
        break;
      case '/transactions':
        await getTransactions();
        break;
      case '/receive':
        await receiveTokens();
        break;
      case '/send':
        await sendTokens(rl);
        break;
      case '/wallet-data':
        await walletData();
        break;
      case '/delete-wallet':
        await deleteWallet(rl);
        break;
      case '/config':
        await configureRPC(rl);
        break;
      case '/set-password':
        if (sessionPassword) {
          console.log(chalk.yellow('Wallet is already encrypted. Use /change-password to change it.'));
        } else {
          await setupPassword(rl);
        }
        break;
      case '/change-password':
        await changePassword(rl);
        break;
      case '/price':
        await fetchTetsuoPrice();
        break;
      case '/exit':
        running = false;
        clearPassword();
        console.log(chalk.green('\nGoodbye! [BYE]\n'));
        break;
      default:
        console.log(chalk.red('[ERROR] Unknown command'));
    }
  }

  clearPassword();
  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
