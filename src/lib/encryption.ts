import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Cache the key in memory after first read
let cachedKey: string | null = null;

/**
 * Get the encryption key.
 * Priority:
 * 1. ENCRYPTION_KEY environment variable (for advanced users)
 * 2. Auto-generated key stored in data directory (default, secure)
 */
function getEncryptionKey(): string {
  // Return cached key if available
  if (cachedKey) {
    return cachedKey;
  }

  // Check environment variable first (allows override)
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    cachedKey = envKey;
    return cachedKey;
  }

  // Auto-generate and persist a key in the data directory
  const dataDir = process.env.DATABASE_URL
    ? dirname(process.env.DATABASE_URL)
    : "./data";
  const keyPath = join(dataDir, ".encryption-key");

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Read existing key or generate new one
  if (existsSync(keyPath)) {
    cachedKey = readFileSync(keyPath, "utf8").trim();
  } else {
    // Generate a secure random key (64 hex chars = 32 bytes)
    cachedKey = randomBytes(32).toString("hex");
    writeFileSync(keyPath, cachedKey, { mode: 0o600 }); // Read/write owner only
    console.log("Generated new encryption key (stored in data volume)");
  }

  return cachedKey;
}

/**
 * Derive a key from the password using scrypt.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns a base64-encoded string containing: salt + iv + tag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const password = getEncryptionKey();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Combine: salt + iv + tag + ciphertext
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a value that was encrypted with encrypt().
 * Returns the original plaintext string.
 */
export function decrypt(encryptedBase64: string): string {
  const password = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt a JSON object.
 */
export function encryptJson<T>(data: T): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt and parse a JSON object.
 */
export function decryptJson<T>(encryptedBase64: string): T {
  const json = decrypt(encryptedBase64);
  return JSON.parse(json) as T;
}
