/**
 * Transaction Example
 * Demonstrates building, signing, and broadcasting transactions
 */

import {
  buildTransaction,
  createTransactionHex,
  signTransaction,
  estimateFee,
  createRPCClient,
  generateWallet,
  UTXO
} from '../src/index';

async function main() {
  console.log('=== TETSUO Wallet SDK - Transaction Example ===\n');

  // Generate wallets
  const sender = await generateWallet();
  const recipient = await generateWallet();

  console.log('Sender:', sender.address);
  console.log('Recipient:', recipient.address);
  console.log();

  // Initialize RPC client
  const rpc = createRPCClient('http://localhost:8080');

  // Check connection
  const isConnected = await rpc.ping();
  console.log('Connected to network:', isConnected ? '✓' : '✗');

  if (!isConnected) {
    console.log('\n⚠ Network is not available. Using mock data for example.\n');

    // Mock UTXOs for demonstration
    const mockUTXOs: UTXO[] = [
      {
        txid: '0000000000000000000000000000000000000000000000000000000000000001',
        vout: 0,
        value: 100_000_000, // 1 TETSUO
        confirmations: 10
      }
    ];

    // Build transaction
    console.log('Building transaction...');
    const { inputs, outputs, fee } = buildTransaction(
      sender.address,
      recipient.address,
      0.5, // Send 0.5 TETSUO
      mockUTXOs,
      sender.address // Change address
    );

    console.log('  Inputs:', inputs.length);
    console.log('  Outputs:', outputs.length);
    console.log('  Fee:', fee, 'satoshis');
    console.log();

    // Create transaction hex
    console.log('Creating transaction hex...');
    const unsignedTx = createTransactionHex(inputs, outputs);
    console.log('  Unsigned TX (first 100 chars):', unsignedTx.substring(0, 100) + '...');
    console.log();

    // Sign transaction
    console.log('Signing transaction...');
    const signedTx = signTransaction(unsignedTx, sender.privateKey, inputs);
    console.log('  Signed TX (first 100 chars):', signedTx.substring(0, 100) + '...');
    console.log();

    // Estimate fee
    console.log('Fee estimation...');
    const estimatedFee = estimateFee(inputs.length, outputs.length);
    console.log('  Estimated Fee:', estimatedFee, 'satoshis');
    console.log();

    console.log('✓ Transaction would be ready to broadcast');
  } else {
    try {
      // Get balance
      const balance = await rpc.getBalance(sender.address);
      console.log('Sender balance:', balance, 'TETSUO\n');

      if (balance < 0.5) {
        console.log('⚠ Insufficient balance for example transaction');
        return;
      }

      // Get UTXOs
      const utxos = await rpc.getUTXOs(sender.address);
      console.log('Available UTXOs:', utxos.length);

      if (utxos.length === 0) {
        console.log('⚠ No UTXOs available');
        return;
      }

      // Build transaction
      console.log('\nBuilding transaction...');
      const { inputs, outputs, fee } = buildTransaction(
        sender.address,
        recipient.address,
        0.5,
        utxos,
        sender.address
      );

      console.log('  Inputs:', inputs.length);
      console.log('  Outputs:', outputs.length);
      console.log('  Fee:', fee, 'satoshis');

      // Create and sign transaction
      const unsignedTx = createTransactionHex(inputs, outputs);
      const signedTx = signTransaction(unsignedTx, sender.privateKey, inputs);

      console.log('\n✓ Transaction ready to broadcast');
      console.log('Signed TX:', signedTx.substring(0, 100) + '...');

      // Broadcast transaction
      console.log('\nBroadcasting transaction...');
      const txid = await rpc.broadcastTransaction(signedTx);
      console.log('✓ Transaction broadcast successfully');
      console.log('Transaction ID:', txid);
    } catch (error) {
      console.error('Error:', (error as Error).message);
    }
  }

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
