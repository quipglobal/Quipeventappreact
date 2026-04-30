/**
 * Per-Conversation Message Encryption
 * ─────────────────────────────────────────────────────────────────────────────
 * AES-GCM 256, key derived via HKDF-SHA256 from a deterministic seed
 * built from the connection id + the two participants' user ids
 * (sorted so both clients derive the *same* key independently).
 *
 * Threat model
 * ────────────
 *   ✓ Server only ever stores `{ ciphertext, iv }` — a DB scrape leaks
 *     no plaintext.
 *   ✓ Network in transit is already TLS via the existing reverse
 *     proxy.
 *   ✗ NOT full E2E with forward secrecy. Anyone who knows
 *     `(connectionId, userAId, userBId)` plus the shared salt can
 *     re-derive the key. The server *does* know the participants, so
 *     a fully-malicious server could derive the key. The win here is
 *     against passive at-rest leaks (database backups, logs, etc.) —
 *     a real upgrade over plaintext-on-server.
 *
 * Hardening path
 * ──────────────
 * Swap the deterministic derivation for a proper Diffie–Hellman key
 * exchange when the backend can store per-user public keys. The
 * client API (`encryptMessage` / `decryptMessage`) doesn't change —
 * only `getOrDeriveConversationKey` would resolve the AES key from a
 * locally cached DH shared secret instead.
 *
 * Format on the wire
 * ──────────────────
 *   { ciphertext: <base64>, iv: <base64>, scheme: 'aes-gcm-hkdf-v1' }
 * The `scheme` field is included so we can rev the format later
 * without a migration window.
 */

/** Versioned tag — bump if we ever change the derivation. */
export const MESSAGE_CRYPTO_SCHEME = 'aes-gcm-hkdf-v1';

/**
 * App-wide salt for HKDF. Constant so both clients agree. Not a
 * secret — its sole job is to domain-separate the key derivation
 * from any other HKDF use that might be added later.
 */
const HKDF_SALT_BYTES = new TextEncoder().encode('cxo-conversation-key-v1');

/**
 * In-memory cache so we don't re-import + HKDF the same key on every
 * keystroke. Keyed by the conversation derivation string.
 */
const keyCache = new Map<string, CryptoKey>();

function buildSeed(connectionId: string, userAId: string, userBId: string): string {
  // Sort so both sides produce the same input regardless of who
  // initiated the conversation.
  const [a, b] = [String(userAId), String(userBId)].sort();
  return `cxo:conv:${connectionId}|${a}|${b}`;
}

async function importHkdfMasterKey(seed: string): Promise<CryptoKey> {
  const seedBytes = new TextEncoder().encode(seed);
  return crypto.subtle.importKey(
    'raw',
    seedBytes,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );
}

/**
 * Derive (or fetch from cache) the AES-GCM key for a conversation.
 * `connectionId` is the accepted-request id; `userAId`/`userBId` are
 * the two participants. Order doesn't matter — internally sorted.
 *
 * Throws if Web Crypto isn't available (server-side render, very old
 * browsers). Callers should treat that as "encryption disabled, fall
 * back to refusing to send" — the UI shouldn't try to ship plaintext.
 */
export async function getOrDeriveConversationKey(
  connectionId: string,
  userAId: string,
  userBId: string,
): Promise<CryptoKey> {
  const seed = buildSeed(connectionId, userAId, userBId);
  const cached = keyCache.get(seed);
  if (cached) return cached;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available — cannot encrypt messages.');
  }
  const master = await importHkdfMasterKey(seed);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT_BYTES,
      info: new TextEncoder().encode(MESSAGE_CRYPTO_SCHEME),
    },
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  keyCache.set(seed, aesKey);
  return aesKey;
}

/** Drop all cached keys — called on sign-out so a different user
 *  signing in on the same device can't reuse the previous user's
 *  derived keys. (They'd be useless anyway since the seeds change,
 *  but defensive.) */
export function clearMessageCryptoCache(): void {
  keyCache.clear();
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  scheme: typeof MESSAGE_CRYPTO_SCHEME;
}

/**
 * Encrypt a UTF-8 plaintext string with the given conversation key.
 * Generates a fresh random 96-bit IV per call — required for AES-GCM
 * to stay confidential when the same key encrypts many messages.
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ptBytes = new TextEncoder().encode(plaintext);
  const ctBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ptBytes);
  return {
    ciphertext: bytesToBase64(new Uint8Array(ctBuffer)),
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
  key: CryptoKey,
): Promise<string> {
  if (payload.scheme && payload.scheme !== MESSAGE_CRYPTO_SCHEME) {
    throw new Error(`Unknown ciphertext scheme: ${payload.scheme}`);
  }
  const iv = base64ToBytes(payload.iv);
  const ct = base64ToBytes(payload.ciphertext);
  const ptBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(ptBuffer);
}
