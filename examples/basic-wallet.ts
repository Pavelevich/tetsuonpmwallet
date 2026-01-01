/**
 * Basic Wallet Example
 * Demonstrates wallet generation and importing
 */

import {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  isValidAddress
} from '../src/index';

async function main() {
  console.log('=== TETSUO Wallet SDK - Basic Example ===\n');

  // 1. Generate a new wallet
  console.log('1. Generating new wallet...');
  const newWallet = await generateWallet();
  console.log('   Mnemonic:', newWallet.mnemonic);
  console.log('   Address:', newWallet.address);
  console.log('   Private Key:', newWallet.privateKey);
  console.log();

  // 2. Import from mnemonic
  console.log('2. Importing wallet from mnemonic...');
  const importedWallet = await importFromMnemonic(newWallet.mnemonic);
  console.log('   Address:', importedWallet.address);
  console.log('   Match:', importedWallet.address === newWallet.address ? '✓' : '✗');
  console.log();

  // 3. Import from private key
  console.log('3. Importing wallet from private key...');
  const pkWallet = importFromPrivateKey(newWallet.privateKey);
  console.log('   Address:', pkWallet.address);
  console.log('   Match:', pkWallet.address === newWallet.address ? '✓' : '✗');
  console.log();

  // 4. Validate address
  console.log('4. Validating address...');
  console.log('   Valid:', isValidAddress(newWallet.address) ? '✓' : '✗');
  console.log('   Invalid test:', isValidAddress('invalid') ? '✗' : '✓');
  console.log();

  console.log('=== Example Complete ===');
}

main().catch(console.error);
