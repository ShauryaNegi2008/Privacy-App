// ============================================================
// HUSH — CRYPTO
// Key never touches the network and never touches the public
// source code. It's derived from a passphrase you type once
// per device, then the resulting CryptoKey is cached (non-
// extractable) in this device's IndexedDB only.
// ============================================================

function strToBytes(str) {
  return new TextEncoder().encode(str);
}
function bytesToStr(bytes) {
  return new TextDecoder().decode(bytes);
}
function bytesToB64(bytes) {
  let binary = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}
function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Derive a non-extractable AES-256-GCM key from the typed passphrase.
async function deriveKeyFromPassphrase(passphrase) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    strToBytes(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: strToBytes(CONFIG.KDF_SALT),
      iterations: CONFIG.KDF_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // not extractable — can't be read back out as raw bytes
    ["encrypt", "decrypt"]
  );
  return key;
}

// Encrypt a UTF-8 string. Returns { iv, ciphertext } both base64.
async function encryptText(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    strToBytes(plaintext)
  );
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(ct) };
}

async function decryptText(key, ivB64, ctB64) {
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return bytesToStr(pt);
}

// Encrypt raw binary (ArrayBuffer/Uint8Array). Returns a single
// Uint8Array: [12-byte IV][ciphertext]. Good for uploading directly
// as a binary Drive file (no base64 bloat).
async function encryptBytes(key, arrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, arrayBuffer);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return out;
}

async function decryptBytes(key, combinedBytes) {
  const bytes = new Uint8Array(combinedBytes);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
}
