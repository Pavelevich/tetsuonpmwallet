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
  isValidMnemonic,
  buildTransaction,
  createTransactionHex,
  signTransaction
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

interface Config {
  rpcUrl: string;
}

// Constants
const WALLET_DIR = path.join(process.env.HOME || '~', '.tetsuo');
const WALLET_FILE = path.join(WALLET_DIR, 'wallets.json');
const CONFIG_FILE = path.join(WALLET_DIR, 'config.json');
let RPC_URL = process.env.TETSUO_RPC_URL || 'https://tetsuoarena.com';

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
    console.log(chalk.red('[ERROR] Wallet name cannot be empty'));
    return;
  }

  try {
    console.log(chalk.yellow('[...] Generating wallet...'));
    const wallet = await generateWallet();

    const store = loadWallets();
    const exists = store.wallets.some(w => w.name === name);
    if (exists) {
      console.log(chalk.red('[ERROR] Wallet with this name already exists'));
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
  const type = await question(rl, 'Import from (mnemonic/privatekey): ');

  if (!name.trim()) {
    console.log(chalk.red('[ERROR] Wallet name cannot be empty'));
    return;
  }

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
      console.log(chalk.yellow('[...] Importing wallet...'));
      wallet = importFromPrivateKey(privateKey);
    } else {
      console.log(chalk.red('[ERROR] Invalid import type'));
      return;
    }

    const store = loadWallets();
    const exists = store.wallets.some(w => w.name === name);
    if (exists) {
      console.log(chalk.red('[ERROR] Wallet with this name already exists'));
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
    console.log(chalk.yellow('  Balance: ') + chalk.green(`${balance.toFixed(8)} TETSUO`));
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
      console.log(`${type} | ${tx.amount.toFixed(8)} TETSUO | Confirmations: ${tx.confirmations}${feeStr} | ${date}`);
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
  if (isNaN(numAmount) || numAmount <= 0) {
    console.log(chalk.red('[ERROR] Invalid amount'));
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
    console.log(chalk.yellow('  Amount:   ') + chalk.green(numAmount.toFixed(8) + ' TETSUO'));
    console.log(chalk.yellow('  Fee:      ') + chalk.yellow((txData.fee / 100_000_000).toFixed(8) + ' TETSUO'));
    console.log(chalk.yellow('  Total:    ') + chalk.cyan((numAmount + txData.fee / 100_000_000).toFixed(8) + ' TETSUO'));
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
    console.log(chalk.yellow('  Amount:   ') + chalk.green(numAmount.toFixed(8) + ' TETSUO'));
    console.log(chalk.yellow('  Fee:      ') + chalk.yellow((txData.fee / 100_000_000).toFixed(8) + ' TETSUO'));
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

// Main CLI Loop
async function main() {
  initWalletStorage();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
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
  console.log(chalk.gray('          Secure Blockchain Wallet • Client-Side Signing • Zero Trust Architecture\n'));

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
      case '/exit':
        running = false;
        console.log(chalk.green('\nGoodbye! [BYE]\n'));
        break;
      default:
        console.log(chalk.red('[ERROR] Unknown command'));
    }
  }

  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
