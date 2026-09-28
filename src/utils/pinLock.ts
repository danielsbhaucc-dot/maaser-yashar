import AsyncStorage from '@react-native-async-storage/async-storage';

/** נעילת מסך בלבד — לא הצפנה של הפנקס. נשמרים רק salt ו-hash. */
export const PIN_STORAGE_KEY = 'maaser_pin_v1';

/** אחרי שהאפליקציה ברקע לפחות כך — מסך הנעילה חוזר */
export const PIN_BACKGROUND_LOCK_MS = 5 * 60 * 1000;

const SALT_BYTES = 16;

type PinRecord = {
  salt: string;
  hash: string;
};

export function isPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** גיבוי כש-crypto.subtle לא קיים (נייד). באינטרנט משתמשים ב-subtle.digest. */
function sha256Fallback(message: Uint8Array): Uint8Array {
  const ml = message.length;
  const zeros = (56 - ((ml + 1) % 64) + 64) % 64;
  const data = new Uint8Array(ml + 1 + zeros + 8);
  data.set(message);
  data[ml] = 0x80;
  const view = new DataView(data.buffer);
  const bits = ml * 8;
  view.setUint32(data.length - 8, Math.floor(bits / 0x100000000), false);
  view.setUint32(data.length - 4, bits >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let i = 0; i < data.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, false);
  ov.setUint32(4, h1, false);
  ov.setUint32(8, h2, false);
  ov.setUint32(12, h3, false);
  ov.setUint32(16, h4, false);
  ov.setUint32(20, h5, false);
  ov.setUint32(24, h6, false);
  ov.setUint32(28, h7, false);
  return out;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', data.slice());
      return bytesToHex(new Uint8Array(digest));
    } catch {
      // נייד / סביבה בלי SubtleCrypto מלא — אותו SHA-256
    }
  }
  return bytesToHex(sha256Fallback(data));
}

function pinPayload(pin: string, salt: Uint8Array): Uint8Array {
  const payload = new Uint8Array(salt.length + pin.length);
  payload.set(salt, 0);
  for (let i = 0; i < pin.length; i++) payload[salt.length + i] = pin.charCodeAt(i) & 0xff;
  return payload;
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  return sha256Hex(pinPayload(pin, salt));
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_BYTES);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('crypto.getRandomValues missing');
  }
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

async function readRecord(): Promise<PinRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PinRecord>;
    if (typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string') return null;
    if (!hexToBytes(parsed.salt) || !/^[0-9a-f]{64}$/i.test(parsed.hash)) return null;
    return { salt: parsed.salt, hash: parsed.hash };
  } catch {
    return null;
  }
}

export async function hasPinLock(): Promise<boolean> {
  return (await readRecord()) != null;
}

export async function savePinLock(pin: string): Promise<void> {
  if (!isPinFormat(pin)) throw new Error('bad pin format');
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  const record: PinRecord = { salt: bytesToHex(salt), hash };
  await AsyncStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(record));
}

export async function verifyPinLock(pin: string): Promise<boolean> {
  if (!isPinFormat(pin)) return false;
  const record = await readRecord();
  if (!record) return false;
  const salt = hexToBytes(record.salt);
  if (!salt) return false;
  const hash = await hashPin(pin, salt);
  return safeEqual(hash, record.hash.toLowerCase());
}

export async function clearPinLock(): Promise<void> {
  await AsyncStorage.removeItem(PIN_STORAGE_KEY);
}
