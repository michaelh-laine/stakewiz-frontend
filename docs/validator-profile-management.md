# Validator profile management — frontend spec & v2 API requirements

Status: frontend shipped in TEST MODE (no backend yet). This doc is the
contract proposal for the v2 API team.

## What the frontend does

Validator operators can sign in with the Solana wallet designated as their
profile **owner** and manage their profile on their validator page:

1. **Connect wallet** (existing wallet-adapter flow, navbar button or the
   claim strip on a validator profile).
2. **Verify ownership** — the profile page detects that the connected wallet
   matches the validator's `owner_pubkey` and offers a "Verify ownership"
   button. Clicking it asks the wallet to sign a human-readable message
   (SIWS-style, no transaction, no fees):

   ```
   stakewiz.com wants you to sign in with your Solana account:
   <pubkey>

   Sign in to manage your validator profile on Stakewiz. This request will
   not trigger a blockchain transaction or cost any fees.

   Nonce: <base58 random>
   Issued At: <ISO-8601>
   Expiration Time: <ISO-8601, +24h>
   ```

3. The signed message is kept client-side as a session (localStorage,
   24h expiry, invalidated when the wallet disconnects or changes) and
   attached to every profile-management API call.
4. Owner tools appear: **post / edit / delete updates** in the "Updates from
   the operator" section (tags: announcement, incident, roadmap, community;
   optional title ≤120 chars; body ≤2000 chars).

Implementation: `lib/validatorAuth.tsx` (sign-in + session),
`lib/validatorUpdates.ts` (updates service + API client),
`components/validator/ProfileHeader.tsx` (claim/verify strip),
`components/validator/ValidatorUpdates.tsx` (updates UI + composer).

## TEST MODE (current state)

- `owner_pubkey` is not yet returned by the API, so
  `lib/validatorAuth.tsx` hard-codes `TEST_OWNER_PUBKEY =
  CBS44H1zS2pp3uRQjkj1B6Hm76dsmr7JAYhTPwpeXYYL` as the owner of **every**
  validator. This is a designated test hot wallet; committing it is
  intentional. Replace with the API field when available.
- `lib/validatorUpdates.ts` has `USE_API = false`: writes require a valid
  signed session (the real wallet UX is exercised) but persist to
  localStorage. Flip to `true` once the endpoints below exist.

## Required v2 API changes

### 1. Owner pubkey on validator responses

Add to `GET /v2/validator/{vote_identity}` (and ideally the list endpoint):

```json
{ "owner_pubkey": "…base58… | null" }
```

How owners get registered is a backend/ops decision (suggested: on-chain
proof — e.g. a memo signed by the validator identity key designating the
owner wallet — or manual verification initially).

### 2. Updates CRUD (mirrors the alert-creation pattern)

```
GET    /v2/validator/{vote_identity}/updates            public
POST   /v2/validator/{vote_identity}/updates            owner-signed
PATCH  /v2/validator/{vote_identity}/updates/{id}       owner-signed
DELETE /v2/validator/{vote_identity}/updates/{id}       owner-signed
```

Update object:

```json
{
  "id": "string",
  "vote_identity": "string",
  "author_pubkey": "string",
  "title": "string?",
  "body": "string (≤2000)",
  "tag": "announcement | incident | roadmap | community",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601?"
}
```

### 3. Auth verification (server side)

Owner-signed requests carry headers:

```
X-Stakewiz-Pubkey:    base58 wallet pubkey
X-Stakewiz-Message:   base64 of the signed sign-in message
X-Stakewiz-Signature: base58 ed25519 signature over the raw message bytes
```

The server must reject unless:
1. `nacl.sign.detached.verify(message, signature, pubkey)` passes,
2. the message's `Expiration Time` is in the future (and `Issued At` sane),
3. the message's account line equals `X-Stakewiz-Pubkey`,
4. the pubkey equals the target validator's `owner_pubkey`.

Recommended hardening: bind the nonce server-side (challenge issued by
`GET /v2/auth/nonce`) to prevent replay across devices; rate-limit writes;
sanitize/escape update bodies (plain text only, no HTML/markdown for v1).

### Why signed-message auth instead of reCAPTCHA-style anonymous writes

Alerts are anonymous, low-risk writes so captcha suffices. Profile updates
are authored, public, reputation-bearing content tied to a specific
validator — they need cryptographic proof of ownership, which wallets give
us for free via `signMessage`.
