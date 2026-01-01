# TETSUO Wallet - Key Derivation Fix

## Problem Discovered

The wallet SDK was using **HMAC-based key derivation** instead of proper **secp256k1 elliptic curve point multiplication**. This is why client-side signatures are failing.

### What's Happening

```
Private Key (same):     f07313a484a766e1d62f4ad6345d54ef7544784edbad686742cb44df210c3ea6

SDK derives (HMAC):     026e9d770f8ba4132a4c7d0b9a14f466bf0b92607e9dfb7abcca3c445c350f9502
Correct (secp256k1):    024809982b467a559be83af9778784ba6a42a8593d5ead22e757e708db4a334f3d

These are DIFFERENT public keys!
```

### Why Signatures Fail

1. UTXO scriptPubKey expects signature valid for: `026e9d77...` (stored pubkey)
2. We sign with private key, but elliptic derives: `024809...` (correct pubkey)
3. Blockchain validates signature against wrong public key
4. Signature fails: `"Signature must be zero for failed CHECK(MULTI)SIG"`

## Solution

### Option 1: Create NEW Wallet with Correct Keys (RECOMMENDED)

```bash
# In CLI, delete old wallets and create new ones
/delete-wallet  # Remove marcus, papa, popo

# Create new wallets - these will use correct secp256k1 derivation
/create-wallet  # Create new wallet
/import-wallet  # Or import from mnemonic
```

Then transfer your TETSUO from old address to new address via another method.

### Option 2: Use Server-Side Signing (Less Secure)

```
Use /api/wallet/sign-and-broadcast endpoint
(Requires deploying updated server.js with hexToWif function)
```

### Option 3: Keep Old Wallets, Accept HMAC Derivation

Accept the HMAC-based derivation as-is. This is not cryptographically correct but maintains compatibility with existing wallets/UTXOs.

Status: ✓ Currently implemented for backward compatibility

## What We Fixed

✅ **Transaction Structure** - Fixed missing varint length field for input scripts
✅ **DER Encoding** - Fixed signature length calculation
✅ **Canonical Signatures** - Added proper S value normalization
✅ **Documentation** - Clearly marked HMAC derivation as non-standard

## What Remains

The fundamental issue is that **all existing wallets** (marcus, papa, popo) were created with incorrect key derivation. To use proper secp256k1 signing:

1. Create new wallets
2. Transfer funds to new addresses
3. Use new wallets for all transactions

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Transaction Structure | ✅ FIXED | Input scripts properly sized |
| DER Encoding | ✅ FIXED | Signatures now canonical |
| Client Signing | ⏳ BLOCKED | Waiting for new wallets with correct keys |
| Server Signing | ⏳ PENDING | Needs server deployment + WIF conversion |

## Next Steps

1. **Understand the trade-off**:
   - Keep old wallets = Can spend existing UTXOs but signature validation edge case
   - Create new wallets = Proper crypto but need to transfer funds first

2. **Choose your approach**:
   - Use server-side signing temporarily (less secure but works)
   - Migrate to new wallets (more complex but fully secure)

3. **Test the chosen solution**

---

**Note**: The HMAC-based derivation is marked with a TODO for future migration to proper secp256k1. All new SDK versions should use correct elliptic curve math.
