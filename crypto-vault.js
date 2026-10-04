/* Bi-guay-Di Cryptography & Local Vault Helper */
// Uses Web Crypto API (standard in modern browsers and PWAs, hardware-accelerated, zero-dependency)

export class SecureVault {
  static async deriveKey(pinOrPassword, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(pinOrPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypts text using AES-256-GCM
  static async encrypt(plainText, pin) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(pin, salt);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(plainText)
    );

    // Pack into Base64 format: salt(16) + iv(12) + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Decrypts text using AES-256-GCM
  static async decrypt(cipherBase64, pin) {
    try {
      const binary = atob(cipherBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const salt = bytes.slice(0, 16);
      const iv = bytes.slice(16, 28);
      const data = bytes.slice(28);

      const key = await this.deriveKey(pin, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (err) {
      throw new Error('PIN o clave incorrecta, o datos manipulados.');
    }
  }
}
