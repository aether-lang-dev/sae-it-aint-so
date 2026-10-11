/**
 * Random number and ID generation functions for REXX interpreter
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

// Helper function for cryptographically secure random integers
const getRandomInt = (min, max) => {
  // Generate cryptographically secure random integer if possible
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValid = 256 ** bytesNeeded - (256 ** bytesNeeded % range);
    
    let randomValue;
    do {
      const randomBytes = new Uint8Array(bytesNeeded);
      crypto.getRandomValues(randomBytes);
      randomValue = 0;
      for (let i = 0; i < bytesNeeded; i++) {
        randomValue = randomValue * 256 + randomBytes[i];
      }
    } while (randomValue >= maxValid);
    
    return min + (randomValue % range);
  } else {
    // Fallback to Math.random (not cryptographically secure)
    return min + Math.floor(Math.random() * (max - min + 1));
  }
};

// Helper function for UUID fallback implementation
const generateUUIDFallback = () => {
  // RFC4122 version 4 UUID fallback implementation
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = (getRandomInt(0, 15));
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const randomFunctions = {
  'UUID': () => {
    // Generate RFC4122 version 4 UUID
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    } else {
      // Fallback implementation
      return generateUUIDFallback();
    }
  },
  
  'NANOID': (length = 21) => {
    // Generate URL-safe unique ID similar to npm's nanoid
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let len = parseInt(length);
    
    // Handle invalid inputs - default to 21
    if (isNaN(len) || len <= 0) {
      len = 21;
    }
    
    let result = '';
    
    for (let i = 0; i < len; i++) {
      result += alphabet.charAt(getRandomInt(0, alphabet.length - 1));
    }
    
    return result;
  },
  
  'RANDOM_HEX': (bytes = 16) => {
    // Generate cryptographically secure hex string
    let numBytes = parseInt(bytes);
    
    // Handle invalid inputs - default to 16
    if (isNaN(numBytes) || numBytes <= 0) {
      numBytes = 16;
    }
    
    let result = '';
    
    for (let i = 0; i < numBytes; i++) {
      const byte = getRandomInt(0, 255);
      result += byte.toString(16).padStart(2, '0');
    }
    
    return result;
  },
  
  'RANDOM_INT': (min = 0, max = 100) => {
    // Generate random integer in range [min, max]
    const minVal = parseInt(min) || 0;
    const maxVal = parseInt(max) || 100;
    return getRandomInt(minVal, maxVal);
  },
  
  'RANDOM_BYTES': (count = 32) => {
    // Generate array of random bytes (as numbers 0-255)
    let numBytes = parseInt(count);
    
    // Handle invalid inputs - default to 32
    if (isNaN(numBytes) || numBytes <= 0) {
      numBytes = 32;
    }
    
    const bytes = [];
    
    for (let i = 0; i < numBytes; i++) {
      bytes.push(getRandomInt(0, 255));
    }
    
    return bytes;
  }

  //TODO insert more random functions here

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { randomFunctions };
} else if (typeof window !== 'undefined') {
  window.randomFunctions = randomFunctions;
}