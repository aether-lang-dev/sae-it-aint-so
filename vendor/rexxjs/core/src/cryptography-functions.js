/**
 * Cryptography and security functions for REXX interpreter
 * 
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const cryptoFunctions = {
  'HASH_SHA256': async (text) => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser environment with Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(String(text));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Node.js environment
      try {
        const crypto = eval('require')('crypto');
        return crypto.createHash('sha256').update(String(text)).digest('hex');
      } catch (e) {
        throw new Error('SHA256 hashing not available - Node.js crypto module not found');
      }
    } else {
      throw new Error('SHA256 hashing not available in this environment');
    }
  },

  'HASH_SHA1': async (text) => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(String(text));
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const crypto = eval('require')('crypto');
        return crypto.createHash('sha1').update(String(text)).digest('hex');
      } catch (e) {
        throw new Error('SHA1 hashing not available - Node.js crypto module not found');
      }
    } else {
      throw new Error('SHA1 hashing not available in this environment');
    }
  },

  'HASH_SHA384': async (text) => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(String(text));
      const hashBuffer = await crypto.subtle.digest('SHA-384', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const crypto = eval('require')('crypto');
        return crypto.createHash('sha384').update(String(text)).digest('hex');
      } catch (e) {
        throw new Error('SHA384 hashing not available - Node.js crypto module not found');
      }
    } else {
      throw new Error('SHA384 hashing not available in this environment');
    }
  },

  'HASH_SHA512': async (text) => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(String(text));
      const hashBuffer = await crypto.subtle.digest('SHA-512', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const crypto = eval('require')('crypto');
        return crypto.createHash('sha512').update(String(text)).digest('hex');
      } catch (e) {
        throw new Error('SHA512 hashing not available - Node.js crypto module not found');
      }
    } else {
      throw new Error('SHA512 hashing not available in this environment');
    }
  },

  'HASH_MD5': (text) => {
    // Pure JS MD5 implementation - works everywhere (buildless-compatible)
    // Note: MD5 is cryptographically broken, use only for non-security purposes

    const str = String(text);

    // Helper functions
    const rotateLeft = (x, n) => (x << n) | (x >>> (32 - n));
    const addUnsigned = (x, y) => {
      const lsw = (x & 0xFFFF) + (y & 0xFFFF);
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xFFFF);
    };

    // MD5 functions
    const F = (x, y, z) => (x & y) | (~x & z);
    const G = (x, y, z) => (x & z) | (y & ~z);
    const H = (x, y, z) => x ^ y ^ z;
    const I = (x, y, z) => y ^ (x | ~z);

    const FF = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    };
    const GG = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    };
    const HH = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    };
    const II = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    };

    // Convert string to UTF-8 bytes
    const utf8Encode = (s) => {
      return unescape(encodeURIComponent(s));
    };

    const strUtf8 = utf8Encode(str);
    const strLen = strUtf8.length;

    // Prepare message blocks (512-bit blocks = 16 x 32-bit words)
    const blocks = [];
    for (let i = 0; i < strLen; i++) {
      const blockIdx = i >> 2;
      const byteIdx = (i % 4) * 8;
      blocks[blockIdx] = blocks[blockIdx] || 0;
      blocks[blockIdx] |= (strUtf8.charCodeAt(i) & 0xFF) << byteIdx;
    }

    // Append padding
    const bitLen = strLen * 8;
    blocks[bitLen >> 5] |= 0x80 << (bitLen % 32);
    blocks[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;

    // MD5 constants
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;

    // Process each 512-bit block
    for (let i = 0; i < blocks.length; i += 16) {
      const aa = a, bb = b, cc = c, dd = d;

      // Round 1
      a = FF(a, b, c, d, blocks[i + 0], 7, 0xD76AA478);
      d = FF(d, a, b, c, blocks[i + 1], 12, 0xE8C7B756);
      c = FF(c, d, a, b, blocks[i + 2], 17, 0x242070DB);
      b = FF(b, c, d, a, blocks[i + 3], 22, 0xC1BDCEEE);
      a = FF(a, b, c, d, blocks[i + 4], 7, 0xF57C0FAF);
      d = FF(d, a, b, c, blocks[i + 5], 12, 0x4787C62A);
      c = FF(c, d, a, b, blocks[i + 6], 17, 0xA8304613);
      b = FF(b, c, d, a, blocks[i + 7], 22, 0xFD469501);
      a = FF(a, b, c, d, blocks[i + 8], 7, 0x698098D8);
      d = FF(d, a, b, c, blocks[i + 9], 12, 0x8B44F7AF);
      c = FF(c, d, a, b, blocks[i + 10], 17, 0xFFFF5BB1);
      b = FF(b, c, d, a, blocks[i + 11], 22, 0x895CD7BE);
      a = FF(a, b, c, d, blocks[i + 12], 7, 0x6B901122);
      d = FF(d, a, b, c, blocks[i + 13], 12, 0xFD987193);
      c = FF(c, d, a, b, blocks[i + 14], 17, 0xA679438E);
      b = FF(b, c, d, a, blocks[i + 15], 22, 0x49B40821);

      // Round 2
      a = GG(a, b, c, d, blocks[i + 1], 5, 0xF61E2562);
      d = GG(d, a, b, c, blocks[i + 6], 9, 0xC040B340);
      c = GG(c, d, a, b, blocks[i + 11], 14, 0x265E5A51);
      b = GG(b, c, d, a, blocks[i + 0], 20, 0xE9B6C7AA);
      a = GG(a, b, c, d, blocks[i + 5], 5, 0xD62F105D);
      d = GG(d, a, b, c, blocks[i + 10], 9, 0x02441453);
      c = GG(c, d, a, b, blocks[i + 15], 14, 0xD8A1E681);
      b = GG(b, c, d, a, blocks[i + 4], 20, 0xE7D3FBC8);
      a = GG(a, b, c, d, blocks[i + 9], 5, 0x21E1CDE6);
      d = GG(d, a, b, c, blocks[i + 14], 9, 0xC33707D6);
      c = GG(c, d, a, b, blocks[i + 3], 14, 0xF4D50D87);
      b = GG(b, c, d, a, blocks[i + 8], 20, 0x455A14ED);
      a = GG(a, b, c, d, blocks[i + 13], 5, 0xA9E3E905);
      d = GG(d, a, b, c, blocks[i + 2], 9, 0xFCEFA3F8);
      c = GG(c, d, a, b, blocks[i + 7], 14, 0x676F02D9);
      b = GG(b, c, d, a, blocks[i + 12], 20, 0x8D2A4C8A);

      // Round 3
      a = HH(a, b, c, d, blocks[i + 5], 4, 0xFFFA3942);
      d = HH(d, a, b, c, blocks[i + 8], 11, 0x8771F681);
      c = HH(c, d, a, b, blocks[i + 11], 16, 0x6D9D6122);
      b = HH(b, c, d, a, blocks[i + 14], 23, 0xFDE5380C);
      a = HH(a, b, c, d, blocks[i + 1], 4, 0xA4BEEA44);
      d = HH(d, a, b, c, blocks[i + 4], 11, 0x4BDECFA9);
      c = HH(c, d, a, b, blocks[i + 7], 16, 0xF6BB4B60);
      b = HH(b, c, d, a, blocks[i + 10], 23, 0xBEBFBC70);
      a = HH(a, b, c, d, blocks[i + 13], 4, 0x289B7EC6);
      d = HH(d, a, b, c, blocks[i + 0], 11, 0xEAA127FA);
      c = HH(c, d, a, b, blocks[i + 3], 16, 0xD4EF3085);
      b = HH(b, c, d, a, blocks[i + 6], 23, 0x04881D05);
      a = HH(a, b, c, d, blocks[i + 9], 4, 0xD9D4D039);
      d = HH(d, a, b, c, blocks[i + 12], 11, 0xE6DB99E5);
      c = HH(c, d, a, b, blocks[i + 15], 16, 0x1FA27CF8);
      b = HH(b, c, d, a, blocks[i + 2], 23, 0xC4AC5665);

      // Round 4
      a = II(a, b, c, d, blocks[i + 0], 6, 0xF4292244);
      d = II(d, a, b, c, blocks[i + 7], 10, 0x432AFF97);
      c = II(c, d, a, b, blocks[i + 14], 15, 0xAB9423A7);
      b = II(b, c, d, a, blocks[i + 5], 21, 0xFC93A039);
      a = II(a, b, c, d, blocks[i + 12], 6, 0x655B59C3);
      d = II(d, a, b, c, blocks[i + 3], 10, 0x8F0CCC92);
      c = II(c, d, a, b, blocks[i + 10], 15, 0xFFEFF47D);
      b = II(b, c, d, a, blocks[i + 1], 21, 0x85845DD1);
      a = II(a, b, c, d, blocks[i + 8], 6, 0x6FA87E4F);
      d = II(d, a, b, c, blocks[i + 15], 10, 0xFE2CE6E0);
      c = II(c, d, a, b, blocks[i + 6], 15, 0xA3014314);
      b = II(b, c, d, a, blocks[i + 13], 21, 0x4E0811A1);
      a = II(a, b, c, d, blocks[i + 4], 6, 0xF7537E82);
      d = II(d, a, b, c, blocks[i + 11], 10, 0xBD3AF235);
      c = II(c, d, a, b, blocks[i + 2], 15, 0x2AD7D2BB);
      b = II(b, c, d, a, blocks[i + 9], 21, 0xEB86D391);

      a = addUnsigned(a, aa);
      b = addUnsigned(b, bb);
      c = addUnsigned(c, cc);
      d = addUnsigned(d, dd);
    }

    // Convert to hex string
    const toHex = (n) => {
      let s = '';
      for (let i = 0; i < 4; i++) {
        s += ((n >> (i * 8)) & 0xFF).toString(16).padStart(2, '0');
      }
      return s;
    };

    return toHex(a) + toHex(b) + toHex(c) + toHex(d);
  },

  'BASE64_ENCODE': (text) => {
    if (typeof btoa !== 'undefined') {
      // Browser environment
      return btoa(String(text));
    } else if (typeof Buffer !== 'undefined') {
      // Node.js environment
      return Buffer.from(String(text)).toString('base64');
    } else {
      throw new Error('Base64 encoding not available in this environment');
    }
  },

  'BASE64_DECODE': (encoded) => {
    try {
      if (typeof atob !== 'undefined') {
        // Browser environment
        return atob(String(encoded));
      } else if (typeof Buffer !== 'undefined') {
        // Node.js environment
        return Buffer.from(String(encoded), 'base64').toString();
      } else {
        throw new Error('Base64 decoding not available in this environment');
      }
    } catch (e) {
      throw new Error(`Invalid base64 input: ${e.message}`);
    }
  },

  'URL_SAFE_BASE64': (text) => {
    const base64 = cryptoFunctions['BASE64_ENCODE'](text);
    // Make URL-safe by replacing + with -, / with _, and removing =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  'RANDOM_STRING': (length = 16, charset = 'alphanumeric') => {
    try {
      let chars = '';
      switch (charset.toLowerCase()) {
        case 'alpha':
          chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
          break;
        case 'numeric':
          chars = '0123456789';
          break;
        case 'alphanumeric':
          chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          break;
        case 'hex':
          chars = '0123456789abcdef';
          break;
        case 'base64':
          chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          break;
        default:
          chars = String(charset); // Use custom charset
      }

      let result = '';
      const len = parseInt(length) || 16;

      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Use crypto API for secure random
        const array = new Uint32Array(len);
        crypto.getRandomValues(array);
        for (let i = 0; i < len; i++) {
          result += chars.charAt(array[i] % chars.length);
        }
      } else {
        // Fallback to Math.random
        for (let i = 0; i < len; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }
      
      return result;
    } catch (e) {
      return 'ERROR';
    }
  },

  'HMAC_SHA256': async (text, secret) => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser Web Crypto API
      const encoder = new TextEncoder();
      const keyData = encoder.encode(String(secret));
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(String(text))
      );
      
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Node.js
      try {
        const crypto = eval('require')('crypto');
        return crypto.createHmac('sha256', String(secret))
          .update(String(text))
          .digest('hex');
      } catch (e) {
        throw new Error('HMAC-SHA256 not available - Node.js crypto module not found');
      }
    } else {
      throw new Error('HMAC-SHA256 not available in this environment');
    }
  },

  'JWT_DECODE': (token) => {
    try {
      const parts = String(token).split('.');
      if (parts.length !== 3) {
        return { error: 'Invalid JWT format' };
      }

      const decoder = cryptoFunctions['BASE64_DECODE'];
      
      // Decode header and payload
      const header = JSON.parse(decoder(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(decoder(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      return {
        header,
        payload,
        signature: parts[2]
      };
    } catch (e) {
      return { error: 'JWT decode failed' };
    }
  },

  'PASSWORD_HASH': async (password, algorithm = 'SHA256') => {
    // Add a salt for better security
    const salt = cryptoFunctions['RANDOM_STRING'](16, 'hex');
    const hasher = cryptoFunctions[`HASH_${algorithm.toUpperCase()}`];
    
    if (!hasher) {
      throw new Error(`Algorithm ${algorithm} not supported`);
    }
    
    const hash = await hasher(password + salt);
    return `${algorithm.toLowerCase()}$${salt}$${hash}`;
  },

  'PASSWORD_VERIFY': async (password, hash) => {
    try {
      const parts = String(hash).split('$');
      if (parts.length !== 3) {
        return false;
      }
      
      const [algorithm, salt, storedHash] = parts;
      const hasher = cryptoFunctions[`HASH_${algorithm.toUpperCase()}`];
      
      if (!hasher) {
        return false;
      }
      
      const computedHash = await hasher(password + salt);
      return computedHash === storedHash;
    } catch (e) {
      return false;
    }
  }

  //TODO insert more crypto functions here

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cryptoFunctions };
} else if (typeof window !== 'undefined') {
  window.cryptoFunctions = cryptoFunctions;
}