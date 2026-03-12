/**
 * SecureShare – Web Crypto API Utilities
 * AES-256-GCM file encryption + RSA-OAEP 2048 key wrapping
 * All encryption/decryption happens exclusively in the browser.
 */

// ── RSA Key Pair Generation ──────────────────────────────────────────────────

export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["wrapKey", "unwrapKey"]
  );
}

// ── RSA Key Export / Import ──────────────────────────────────────────────────

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exported);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const binary = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey"]
  );
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(exported);
}

export async function importPrivateKey(base64: string): Promise<CryptoKey> {
  const binary = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["unwrapKey"]
  );
}

// ── AES Key Generation ──────────────────────────────────────────────────────

export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ── File Encryption / Decryption (AES-GCM) ──────────────────────────────────

export interface EncryptedPayload {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

export async function encryptFile(
  aesKey: CryptoKey,
  data: ArrayBuffer
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );
  return { iv, ciphertext };
}

export async function decryptFile(
  aesKey: CryptoKey,
  iv: Uint8Array,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext);
}

// ── AES Key Wrapping with RSA ────────────────────────────────────────────────

export async function wrapAESKey(
  aesKey: CryptoKey,
  rsaPublicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", aesKey, rsaPublicKey, {
    name: "RSA-OAEP",
  });
  return arrayBufferToBase64(wrapped);
}

export async function unwrapAESKey(
  wrappedKeyBase64: string,
  rsaPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    rsaPrivateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  );
}

// ── Helpers: ArrayBuffer ↔ Base64 ────────────────────────────────────────────

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Pack IV + ciphertext into a single blob for upload.
 * Format: [12 bytes IV] [ciphertext...]
 */
export function packEncryptedFile(payload: EncryptedPayload): Blob {
  const ivBytes = payload.iv;
  const ctBytes = new Uint8Array(payload.ciphertext);
  const combined = new Uint8Array(ivBytes.length + ctBytes.length);
  combined.set(ivBytes, 0);
  combined.set(ctBytes, ivBytes.length);
  return new Blob([combined], { type: "application/octet-stream" });
}

/**
 * Unpack IV + ciphertext from a downloaded encrypted blob.
 */
export function unpackEncryptedFile(data: ArrayBuffer): {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
} {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12).buffer;
  return { iv, ciphertext };
}
