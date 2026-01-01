import {
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  isValidMnemonic,
  derivePublicKey
} from '../src/wallet';
import { isValidAddress } from '../src/address';

describe('Wallet', () => {
  it('should generate a new wallet', async () => {
    const wallet = await generateWallet();

    expect(wallet).toHaveProperty('mnemonic');
    expect(wallet).toHaveProperty('privateKey');
    expect(wallet).toHaveProperty('publicKey');
    expect(wallet).toHaveProperty('address');

    // Mnemonic should be 12 words
    expect(wallet.mnemonic.split(' ').length).toBe(12);

    // Private key should be 64 hex characters
    expect(wallet.privateKey.length).toBe(64);

    // Address should be valid
    expect(isValidAddress(wallet.address)).toBe(true);
    expect(wallet.address.startsWith('T')).toBe(true);
  });

  it('should import wallet from mnemonic', async () => {
    const generated = await generateWallet();
    const imported = await importFromMnemonic(generated.mnemonic);

    expect(imported.mnemonic).toBe(generated.mnemonic);
    expect(imported.privateKey).toBe(generated.privateKey);
    expect(imported.publicKey).toBe(generated.publicKey);
    expect(imported.address).toBe(generated.address);
  });

  it('should reject invalid mnemonic', async () => {
    expect(isValidMnemonic('invalid mnemonic phrase')).toBe(false);
  });

  it('should import wallet from private key', async () => {
    const generated = await generateWallet();
    const imported = importFromPrivateKey(generated.privateKey);

    expect(imported.privateKey).toBe(generated.privateKey);
    expect(imported.publicKey).toBe(generated.publicKey);
    expect(imported.address).toBe(generated.address);
  });

  it('should reject invalid private key', () => {
    expect(() => {
      importFromPrivateKey('invalid');
    }).toThrow();

    expect(() => {
      importFromPrivateKey('0000');
    }).toThrow();
  });

  it('should derive consistent public keys', () => {
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
    const publicKey1 = derivePublicKey(privateKey);
    const publicKey2 = derivePublicKey(privateKey);

    expect(publicKey1).toBe(publicKey2);
    expect(publicKey1.length).toBe(66); // 33 bytes * 2 hex chars
  });
});
