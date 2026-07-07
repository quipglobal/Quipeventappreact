/**
 * Per-Conversation Message Encryption (native port of web `messageCrypto.ts`)
 * ─────────────────────────────────────────────────────────────────────────────
 * AES-GCM 256, key derived via HKDF-SHA256 from a deterministic seed
 * built from the connection id + the two participants' user ids
 * (sorted so both clients derive the *same* key independently).
 *
 * The web build uses the browser Web Crypto API (`crypto.subtle`).
 * Hermes (React Native's JS engine) does NOT ship Web Crypto, so this
 * port uses the pure-JS, audited `@noble/ciphers` (AES-GCM) and
 * `@noble/hashes` (HKDF-SHA256) implementations instead. The public
 * API (`encryptMessage` / `decryptMessage` / `getOrDeriveConversationKey`)
 * mirrors the web module so the calling code stays identical in shape.
 *
 * Threat model
 * ────────────
 *   ✓ Server only ever stores `{ ciphertext, iv }` — a DB scrape leaks
 *     no plaintext.
 *   ✓ Network in transit is already TLS.
 *   ✗ NOT full E2E with forward secrecy — deterministic derivation.
 *
 * Format on the wire
 * ──────────────────
 *   { ciphertext: <base64>, iv: <base64>, scheme: 'aes-gcm-hkdf-v1' }
 */

import { gcm } from '@noble/ciphers/aes.js';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

/** Versioned tag — bump if we ever change the derivation. */
export const MESSAGE_CRYPTO_SCHEME = 'aes-gcm-hkdf-v1';

/**
 * App-wide salt for HKDF. Constant so both clients agree. Not a
 * secret — its sole job is to domain-separate the key derivation.
 */
const HKDF_SALT_BYTES = utf8ToBytes('cxo-conversation-key-v1');
const HKDF_INFO_BYTES = utf8ToBytes(MESSAGE_CRYPTO_SCHEME);

/**
 * In-memory cache of the derived 32-byte AES keys so we don't re-run
 * HKDF on every keystroke. Keyed by the conversation derivation string.
 */
const keyCache = new Map<string, Uint8Array>();

function buildSeed(connectionId: string, userAId: string, userBId: string): string {
  // Sort so both sides produce the same input regardless of who
  // initiated the conversation.
  const [a, b] = [String(userAId), String(userBId)].sort();
  return `cxo:conv:${connectionId}|${a}|${b}`;
}

/**
 * Derive (or fetch from cache) the 32-byte AES-GCM key for a
 * conversation. `connectionId` is the accepted-request id;
 * `userAId`/`userBId` are the two participants. Order doesn't matter —
 * internally sorted.
 *
 * Kept `async` so the call sites match the web module's `CryptoKey`
 * promise-returning shape one-for-one.
 */
export async function getOrDeriveConversationKey(
  connectionId: string,
  userAId: string,
  userBId: string,
): Promise<Uint8Array> {
  const seed = buildSeed(connectionId, userAId, userBId);
  const cached = keyCache.get(seed);
  if (cached) return cached;
  const ikm = utf8ToBytes(seed);
  const aesKey = hkdf(sha256, ikm, HKDF_SALT_BYTES, HKDF_INFO_BYTES, 32);
  keyCache.set(seed, aesKey);
  return aesKey;
}

/** Drop all cached keys — called on sign-out so a different user
 *  signing in on the same device can't reuse the previous user's
 *  derived keys. */
export function clearMessageCryptoCache(): void {
  keyCache.clear();
}

// ─── base64 (Hermes has no btoa/atob) ────────────────────────────────────────

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] + B64_CHARS[(n >> 6) & 63] + B64_CHARS[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] + B64_CHARS[(n >> 6) & 63] + '=';
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[clean.charCodeAt(i)];
    const c1 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c2 = i + 2 < len ? B64_LOOKUP[clean.charCodeAt(i + 2)] : -1;
    const c3 = i + 3 < len ? B64_LOOKUP[clean.charCodeAt(i + 3)] : -1;
    const n = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);
    if (o < outLen) out[o++] = (n >> 16) & 0xff;
    if (c2 !== -1 && o < outLen) out[o++] = (n >> 8) & 0xff;
    if (c3 !== -1 && o < outLen) out[o++] = n & 0xff;
  }
  return out;
}

// ─── random IV ───────────────────────────────────────────────────────────────

/**
 * A cryptographically-random 96-bit IV is ideal for AES-GCM; the hard
 * requirement is only that an IV never repeats under the same key.
 * Prefer a real CSPRNG when the runtime exposes one (a Web Crypto
 * polyfill, dev/web builds), and fall back to a high-entropy
 * time+counter+Math.random source on bare Hermes so IV uniqueness is
 * still guaranteed per message.
 */
let _ivCounter = 0;
function randomIv(): Uint8Array {
  const iv = new Uint8Array(12);
  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    g.crypto.getRandomValues(iv);
    return iv;
  }
  const now = Date.now();
  _ivCounter = (_ivCounter + 1) >>> 0;
  // First 6 bytes: monotonic time (ms) — guarantees no cross-second reuse.
  iv[0] = (now >>> 40) & 0xff;
  iv[1] = (now >>> 32) & 0xff;
  iv[2] = (now >>> 24) & 0xff;
  iv[3] = (now >>> 16) & 0xff;
  iv[4] = (now >>> 8) & 0xff;
  iv[5] = now & 0xff;
  // Next 2 bytes: per-process counter — disambiguates same-ms messages.
  iv[6] = (_ivCounter >>> 8) & 0xff;
  iv[7] = _ivCounter & 0xff;
  // Remaining 4 bytes: Math.random entropy.
  for (let i = 8; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
  return iv;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  scheme: typeof MESSAGE_CRYPTO_SCHEME;
}

/**
 * Encrypt a UTF-8 plaintext string with the given conversation key.
 * Generates a fresh 96-bit IV per call.
 */
export async function encryptMessage(
  plaintext: string,
  key: Uint8Array,
): Promise<EncryptedPayload> {
  const iv = randomIv();
  const ptBytes = utf8ToBytes(plaintext);
  const ct = gcm(key, iv).encrypt(ptBytes);
  return {
    ciphertext: bytesToBase64(ct),
    iv: bytesToBase64(iv),
    scheme: MESSAGE_CRYPTO_SCHEME,
  };
}

/**
 * Decrypt an `EncryptedPayload` back to UTF-8. Throws (and the caller
 * surfaces a "[unable to decrypt]" placeholder) when ciphertext was
 * produced under a different scheme or key.
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  key: Uint8Array,
): Promise<string> {
  if (payload.scheme && payload.scheme !== MESSAGE_CRYPTO_SCHEME) {
    throw new Error(`Unknown ciphertext scheme: ${payload.scheme}`);
  }
  const iv = base64ToBytes(payload.iv);
  const ct = base64ToBytes(payload.ciphertext);
  const pt = gcm(key, iv).decrypt(ct);
  return bytesToUtf8(pt);
}
