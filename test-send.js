#!/usr/bin/env node

/**
 * TETSUO Wallet - Client-Side Signing Test
 * Tests complete transaction flow with secp256k1 derivation
 */

const fs = require('fs');
const path = require('path');
const {
  generateWallet,
  createRPCClient,
  buildTransaction,
  createTransactionHex,
  signTransaction,
  derivePublicKey,
  generateAddress
} = require('./dist/index');

const WALLET_FILE = path.join(process.env.HOME, '.tetsuo', 'wallets.json');
const RPC_URL = 'https://tetsuoarena.com';

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('  TETSUO Wallet - Client-Side Signing Test');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Create new test wallet
    console.log('📝 Step 1: Creating new test wallet...');
    const testWallet = await generateWallet();

    console.log('✓ New wallet created:');
    console.log(`  Name: test_${Date.now()}`);
    console.log(`  Address: ${testWallet.address}`);
    console.log(`  Private Key: ${testWallet.privateKey.slice(0, 16)}...`);

    // Verify key derivation is secp256k1
    const rederived = derivePublicKey(testWallet.privateKey);
    const match = testWallet.publicKey === rederived;
    console.log(`  Public Key Match (secp256k1): ${match ? '✓' : '✗'}`);

    if (!match) {
      console.log('✗ ERROR: Public key derivation mismatch!');
      console.log(`  Stored:    ${testWallet.publicKey}`);
      console.log(`  Rederived: ${rederived}`);
      return;
    }

    // Step 2: Check balance on test address
    console.log('\n💰 Step 2: Checking balance...');
    const rpc = createRPCClient(RPC_URL);

    let balance = 0;
    try {
      balance = await rpc.getBalance(testWallet.address);
      console.log(`✓ Balance: ${balance} TETSUO`);
    } catch (e) {
      console.log(`⚠ No balance yet (address just created)`);
    }

    if (balance === 0) {
      console.log('\n⚠️  Test wallet has no balance.');
      console.log(`Send some TETSUO to: ${testWallet.address}`);
      console.log('Then run this test again.\n');

      // Save test wallet for reference
      const walletStore = {
        name: `test_${Date.now()}`,
        privateKey: testWallet.privateKey,
        publicKey: testWallet.publicKey,
        address: testWallet.address,
        mnemonic: testWallet.mnemonic,
        createdAt: new Date().toISOString()
      };

      console.log('Test wallet info (save this):');
      console.log(JSON.stringify(walletStore, null, 2));
      return;
    }

    // Step 3: Prepare transaction
    console.log('\n📋 Step 3: Preparing transaction...');
    const testAddress = 'TVt1p2fcKTQXZVidshJbDCdYN3wxRnWLES';
    const sendAmount = 0.1; // Small test amount

    const utxos = await rpc.getUTXOs(testWallet.address);
    console.log(`✓ Found ${utxos.length} UTXO(s)`);

    if (utxos.length === 0) {
      console.log('✗ No UTXOs available');
      return;
    }

    const txData = buildTransaction(
      testWallet.address,
      testAddress,
      sendAmount,
      utxos,
      testWallet.address
    );

    console.log('✓ Transaction built:');
    console.log(`  From: ${testWallet.address}`);
    console.log(`  To: ${testAddress}`);
    console.log(`  Amount: ${sendAmount} TETSUO`);
    console.log(`  Fee: ${(txData.fee / 100_000_000).toFixed(8)} TETSUO`);

    // Step 4: Sign transaction
    console.log('\n✍️  Step 4: Signing transaction (client-side)...');
    const unsignedHex = createTransactionHex(txData.inputs, txData.outputs);
    const signedHex = signTransaction(unsignedHex, testWallet.privateKey, txData.inputs, utxos);

    console.log('✓ Transaction signed:');
    console.log(`  Unsigned size: ${unsignedHex.length} chars (${unsignedHex.length / 2} bytes)`);
    console.log(`  Signed size: ${signedHex.length} chars (${signedHex.length / 2} bytes)`);
    console.log(`  Signature added: ${(signedHex.length - unsignedHex.length) / 2} bytes`);

    // Step 5: Broadcast
    console.log('\n📤 Step 5: Broadcasting transaction...');
    try {
      const txid = await rpc.broadcastTransaction(signedHex);

      console.log('✅ SUCCESS! Transaction broadcasted!');
      console.log(`\n📊 Transaction Details:`);
      console.log(`  TXID: ${txid}`);
      console.log(`  From: ${testWallet.address}`);
      console.log(`  To: ${testAddress}`);
      console.log(`  Amount: ${sendAmount} TETSUO`);
      console.log(`  Explorer: https://tetsuoarena.com/tx/${txid}\n`);

      return true;
    } catch (broadcastError) {
      console.log('✗ Broadcast failed:', broadcastError.message);
      console.log('\nDiagnostics:');
      console.log('  Signed TX hex:', signedHex.substring(0, 100) + '...');

      return false;
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    return false;
  }
}

// Run test
runTest().then(success => {
  process.exit(success ? 0 : 1);
});
