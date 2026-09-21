// AES-256-GCM encryption for localStorage
const ENCRYPTION_KEY = import.meta.env.VITE_STORAGE_KEY || 'default_secure_key_123456789012'; // 32 chars max/min if we hash it

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Hash the string to get a 256-bit key
  const keyMaterial = await window.crypto.subtle.digest('SHA-256', enc.encode(ENCRYPTION_KEY));
  
  return window.crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      const cryptoKey = await getCryptoKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        enc.encode(value)
      );

      // Store IV and encrypted data together
      const payload = JSON.stringify({
        iv: bufferToBase64(iv.buffer),
        data: bufferToBase64(encrypted)
      });
      
      localStorage.setItem(key, payload);
    } catch (e) {
      console.error('Encryption failed', e);
      localStorage.setItem(key, value); // Fallback
    }
  },

  async getItem(key: string): Promise<string | null> {
    const payloadStr = localStorage.getItem(key);
    if (!payloadStr) return null;

    try {
      const payload = JSON.parse(payloadStr);
      if (!payload.iv || !payload.data) return payloadStr; // Was not encrypted

      const cryptoKey = await getCryptoKey();
      const iv = base64ToBuffer(payload.iv);
      const data = base64ToBuffer(payload.data);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        cryptoKey,
        data
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (e) {
      console.error('Decryption failed', e);
      return payloadStr; // Try returning raw string if it wasn't valid JSON/encrypted
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
};
