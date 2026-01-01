# TETSUO Wallet SDK - Deployment & Testing Guide

## Current Status

✅ **SDK Updates Completed:**
- Fixed transaction structure (missing script length field)
- Fixed DER signature encoding
- Added canonical S value normalization
- Implemented `/send` CLI command

⏳ **Server Updates Pending:**
- Added `hexToWif()` function for private key conversion
- Updated `/api/wallet/sign-and-broadcast` endpoint

---

## Step 1: Deploy Updated Server

### Option A: Using SSH (recommended)

Replace the server.js on the remote server:

```bash
scp /Users/pchmirenko/Desktop/tetsuo-explorer-live/server.js root@165.227.69.246:/root/tetsuo-explorer/server.js
```

Then restart the service:

```bash
ssh root@165.227.69.246 "cd /root/tetsuo-explorer && pm2 restart tetsuo-explorer"
```

### Option B: Manual Update

1. Open the file on the remote server:
   ```
   /root/tetsuo-explorer/server.js
   ```

2. Find the `sign-and-broadcast` endpoint (around line 729)

3. Replace the endpoint with the updated version that includes `hexToWif()` function

4. Restart the service:
   ```bash
   pm2 restart tetsuo-explorer
   ```

---

## Step 2: Test Locally

### Run the CLI

```bash
cd /private/tmp/tetsuo-wallet-sdk
node dist/cli.js
```

### Test the `/send` Command

In the CLI, run:

```
/send
```

Then follow the prompts:
- Recipient: `TVt1p2fcKTQXZVidshJbDCdYN3wxRnWLES` (or another address)
- Amount: `0.5` (TETSUO)
- Confirm: `yes`

### Expected Result

If server is updated:
```
✅ Transaction sent successfully!
TXID: a1b2c3d4e5f6...
Check at: https://tetsuoarena.com/tx/a1b2c3d4e5f6...
```

If server not updated:
```
✗ Error: Client signing verification failed, using server signature...
✗ Error: Invalid private key
```

---

## Step 3: What Each Fix Does

### Fix #1: Transaction Structure
- **File:** `src/transaction.ts` line 236
- **Issue:** Missing varint length field for input script
- **Effect:** Transactions no longer get "TX decode failed" error
- **Status:** ✅ DEPLOYED in SDK 1.2.1

### Fix #2: DER Signature Encoding
- **File:** `src/transaction.ts` line 372
- **Issue:** Incorrect length calculation (66 instead of 68 bytes)
- **Effect:** Signatures no longer get "Non-canonical DER" error
- **Status:** ✅ DEPLOYED in SDK 1.2.1

### Fix #3: WIF Key Conversion
- **File:** `server.js` line 730
- **Issue:** Server expects WIF format, not raw hex
- **Effect:** Server-side signing fallback will work
- **Status:** ⏳ PENDING - Needs server deployment

---

## Troubleshooting

### If you get "Invalid private key" error:
1. ❌ Server still has old code
2. ✅ Solution: Deploy updated server.js

### If you get "Signature must be zero for failed CHECK(MULTI)SIG":
1. This means DER encoding is fixed ✅
2. But ECDSA signature verification is still failing
3. Next step: Debug signature preimage creation

### If CLI won't start:
```bash
# Make sure you're in the right directory
cd /private/tmp/tetsuo-wallet-sdk

# Rebuild if needed
npm run build

# Run CLI
node dist/cli.js
```

---

## Files Modified

```
/private/tmp/tetsuo-wallet-sdk/
├── src/
│   ├── transaction.ts (FIXED - signature handling)
│   └── rpc.ts (comments updated)
├── package.json (version 1.2.1)
└── dist/ (built & ready)

/Users/pchmirenko/Desktop/tetsuo-explorer-live/
└── server.js (NEEDS DEPLOYMENT - WIF conversion added)
```

---

## Next Steps

1. **Deploy server** (Step 1 above)
2. **Test locally** (Step 2 above)
3. **Report results**:
   - What error do you get?
   - Is the transaction being broadcast?
   - Does the TXID appear?

