#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  isValidAddress,
  createRPCClient,
  isValidMnemonic
} from './index';
import chalk from 'chalk';

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

// Constants
const WALLET_DIR = path.join(process.env.HOME || '~', '.tetsuo');
const WALLET_FILE = path.join(WALLET_DIR, 'wallets.json');
const RPC_URL = process.env.TETSUO_RPC_URL || 'http://localhost:8080';

// Ensure wallet directory exists
function initWalletStorage() {
  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { recursive: true });
  }
  if (!fs.existsSync(WALLET_FILE)) {
    fs.writeFileSync(WALLET_FILE, JSON.stringify({ wallets: [] }, null, 2));
  }
}

// Load wallets from storage
function loadWallets(): WalletStore {
  try {
    const data = fs.readFileSync(WALLET_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { wallets: [] };
  }
}

// Save wallets to storage
function saveWallets(store: WalletStore) {
  fs.writeFileSync(WALLET_FILE, JSON.stringify(store, null, 2));
}

// CLI Commands
async function createWallet(rl: readline.Interface): Promise<void> {
  const name = await question(rl, 'Wallet name: ');
  if (!name.trim()) {
    console.log(chalk.red('✗ Wallet name cannot be empty'));
    return;
  }

  try {
    console.log(chalk.yellow('⏳ Generating wallet...'));
    const wallet = await generateWallet();

    const store = loadWallets();
    const exists = store.wallets.some(w => w.name === name);
    if (exists) {
      console.log(chalk.red('✗ Wallet with this name already exists'));
      return;
    }

    store.wallets.push({
      name,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic,
      createdAt: new Date().toISOString()
    });

    if (!store.selectedWallet) {
      store.selectedWallet = name;
    }

    saveWallets(store);

    console.log(chalk.green('✓ Wallet created successfully!'));
    console.log(chalk.cyan('\n📝 Mnemonic (BACKUP THIS):'));
    console.log(chalk.yellow(wallet.mnemonic));
    console.log(chalk.cyan('\n📍 Address:'));
    console.log(chalk.yellow(wallet.address));
  } catch (error: any) {
    console.log(chalk.red(`✗ Error: ${error.message}`));
  }
}

async function importWallet(rl: readline.Interface): Promise<void> {
  const name = await question(rl, 'Wallet name: ');
  const type = await question(rl, 'Import from (mnemonic/privatekey): ');

  if (!name.trim()) {
    console.log(chalk.red('✗ Wallet name cannot be empty'));
    return;
  }

  try {
    let wallet;

    if (type.toLowerCase() === 'mnemonic') {
      const mnemonic = await question(rl, 'Enter mnemonic (12 words): ');
      if (!isValidMnemonic(mnemonic)) {
        console.log(chalk.red('✗ Invalid mnemonic'));
        return;
      }
      console.log(chalk.yellow('⏳ Importing wallet...'));
      wallet = await importFromMnemonic(mnemonic);
    } else if (type.toLowerCase() === 'privatekey') {
      const privateKey = await question(rl, 'Enter private key (hex): ');
      console.log(chalk.yellow('⏳ Importing wallet...'));
      wallet = importFromPrivateKey(privateKey);
    } else {
      console.log(chalk.red('✗ Invalid import type'));
      return;
    }

    const store = loadWallets();
    const exists = store.wallets.some(w => w.name === name);
    if (exists) {
      console.log(chalk.red('✗ Wallet with this name already exists'));
      return;
    }

    store.wallets.push({
      name,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: (wallet as any).mnemonic,
      createdAt: new Date().toISOString()
    });

    if (!store.selectedWallet) {
      store.selectedWallet = name;
    }

    saveWallets(store);
    console.log(chalk.green('✓ Wallet imported successfully!'));
    console.log(chalk.cyan('📍 Address:'));
    console.log(chalk.yellow(wallet.address));
  } catch (error: any) {
    console.log(chalk.red(`✗ Error: ${error.message}`));
  }
}

async function listWallets(): Promise<void> {
  const store = loadWallets();

  if (store.wallets.length === 0) {
    console.log(chalk.yellow('No wallets found. Create one first!'));
    return;
  }

  console.log(chalk.cyan('\n📊 Your Wallets:'));
  console.log('─'.repeat(80));

  store.wallets.forEach((wallet, index) => {
    const selected = store.selectedWallet === wallet.name ? ' ✓' : '';
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
    console.log(chalk.green(`✓ Selected: ${store.wallets[index].name}`));
  } else {
    console.log(chalk.red('✗ Invalid selection'));
  }
}

async function getBalance(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('✗ No wallet selected'));
    return;
  }

  try {
    console.log(chalk.yellow('⏳ Fetching balance...'));
    const rpc = createRPCClient(RPC_URL);
    const balance = await rpc.getBalance(wallet.address);

    console.log(chalk.cyan('\n💰 Balance:'));
    console.log(chalk.green(`${balance.toFixed(8)} TETSUO`));
  } catch (error: any) {
    console.log(chalk.red(`✗ Error: ${error.message}`));
  }
}

async function getTransactions(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('✗ No wallet selected'));
    return;
  }

  try {
    console.log(chalk.yellow('⏳ Fetching transactions...'));
    const rpc = createRPCClient(RPC_URL);
    const transactions = await rpc.getTransactionHistory(wallet.address);

    if (transactions.length === 0) {
      console.log(chalk.yellow('No transactions found'));
      return;
    }

    console.log(chalk.cyan('\n📋 Transaction History:'));
    console.log('─'.repeat(80));

    transactions.forEach((tx: any) => {
      const type = tx.type === 'receive' ? chalk.green('↓ RECEIVE') : chalk.yellow('↑ SEND');
      console.log(`${type} | ${tx.amount} TETSUO | ${tx.date}`);
    });
    console.log('─'.repeat(80));
  } catch (error: any) {
    console.log(chalk.red(`✗ Error: ${error.message}`));
  }
}

async function receiveTokens(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('✗ No wallet selected'));
    return;
  }

  console.log(chalk.cyan('\n📍 Receive Address:'));
  console.log(chalk.green(wallet.address));
  console.log(chalk.yellow('\nShare this address to receive TETSUO'));
}

async function sendTokens(rl: readline.Interface): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('✗ No wallet selected'));
    return;
  }

  const toAddress = await question(rl, 'Recipient address: ');
  if (!isValidAddress(toAddress)) {
    console.log(chalk.red('✗ Invalid recipient address'));
    return;
  }

  const amount = await question(rl, 'Amount (TETSUO): ');
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    console.log(chalk.red('✗ Invalid amount'));
    return;
  }

  console.log(chalk.yellow('⏳ Preparing transaction...'));
  console.log(chalk.yellow('⚠️  Feature not fully implemented in CLI'));
  console.log(chalk.cyan('Use the iOS app or integrate with your backend to broadcast'));
}

async function walletData(): Promise<void> {
  const store = loadWallets();
  const wallet = store.wallets.find(w => w.name === store.selectedWallet);

  if (!wallet) {
    console.log(chalk.red('✗ No wallet selected'));
    return;
  }

  console.log(chalk.cyan('\n📊 Wallet Data:'));
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
    console.log(chalk.red('✗ No wallet selected'));
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
  console.log(chalk.green('✓ Wallet deleted'));
}

// Helper to get user input
function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(chalk.cyan(prompt), resolve);
  });
}

// Main CLI Loop
async function main() {
  initWalletStorage();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.clear();
  console.log(chalk.green.bold('\n═══════════════════════════════'));
  console.log(chalk.green.bold('   TETSUO Wallet CLI'));
  console.log(chalk.green.bold('═══════════════════════════════\n'));

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
      case '/exit':
        running = false;
        console.log(chalk.green('\nGoodbye! 👋\n'));
        break;
      default:
        console.log(chalk.red('✗ Unknown command'));
    }
  }

  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
