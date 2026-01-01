import { generateAddress, isValidAddress, validateAddress, addressToHash160 } from '../src/address';
import { toHex } from '../src/crypto';

describe('Address', () => {
  it('should generate valid addresses', () => {
    const publicKey1 = '020000000000000000000000000000000000000000000000000000000000000001';
    const address1 = generateAddress(publicKey1);

    expect(address1).toBeTruthy();
    expect(address1.startsWith('T')).toBe(true);
    expect(isValidAddress(address1)).toBe(true);
  });

  it('should validate addresses correctly', () => {
    const publicKey = '020000000000000000000000000000000000000000000000000000000000000001';
    const address = generateAddress(publicKey);

    expect(isValidAddress(address)).toBe(true);
  });

  it('should reject invalid addresses', () => {
    expect(isValidAddress('invalid')).toBe(false);
    expect(isValidAddress('1ABC')).toBe(false); // Starts with 1, not T
    expect(isValidAddress('TInvalidChecksum')).toBe(false);
    expect(isValidAddress('')).toBe(false);
    expect(isValidAddress(null as any)).toBe(false);
  });

  it('should validate address and throw on invalid', () => {
    const publicKey = '020000000000000000000000000000000000000000000000000000000000000001';
    const address = generateAddress(publicKey);

    expect(validateAddress(address)).toBe(address);

    expect(() => {
      validateAddress('invalid');
    }).toThrow();
  });

  it('should extract hash160 from address', () => {
    const publicKey = '020000000000000000000000000000000000000000000000000000000000000001';
    const address = generateAddress(publicKey);
    const hash = addressToHash160(address);

    expect(hash.length).toBe(20); // 20 bytes
  });

  it('should generate same address for same public key', () => {
    const publicKey = '020000000000000000000000000000000000000000000000000000000000000001';
    const address1 = generateAddress(publicKey);
    const address2 = generateAddress(publicKey);

    expect(address1).toBe(address2);
  });
});
