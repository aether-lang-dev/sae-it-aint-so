/**
 * Validation functions for REXX interpreter
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

// Helper function to determine REXX-style data types for JavaScript values
function getDataType(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (Array.isArray(value)) {
    return 'ARRAY';
  }
  
  if (typeof value === 'string') {
    // Check if string represents a number
    if (!isNaN(parseFloat(value)) && isFinite(value)) {
      return 'NUM';
    }
    return 'CHAR';
  }
  
  if (typeof value === 'number') {
    return 'NUM';
  }
  
  if (typeof value === 'boolean') {
    return 'BOOL';
  }
  
  if (typeof value === 'object') {
    return 'OBJECT';
  }
  
  if (typeof value === 'function') {
    return 'FUNCTION';
  }
  
  return 'UNKNOWN';
}

const validationFunctions = {
  'IS_EMAIL': (email) => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(String(email));
    } catch (e) {
      return false;
    }
  },

  'IS_URL': (url) => {
    try {
      const urlObj = new URL(String(url));
      return ['http:', 'https:', 'ftp:', 'file:'].includes(urlObj.protocol);
    } catch (e) {
      return false;
    }
  },

  'IS_PHONE': (phone, format = 'any') => {
    try {
      const phoneStr = String(phone);
      const cleanPhone = phoneStr.replace(/[\s\-\(\)\.]/g, '');
      
      switch (format.toLowerCase()) {
        case 'us':
        case 'usa':
          // US: +1 (555) 123-4567, 555-123-4567, (555) 123-4567, etc.
          return /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(phoneStr);
          
        case 'uk':
        case 'gb':
          // UK: +44 20 1234 5678, 020 1234 5678, etc.
          return /^(\+44|0)[1-9]\d{8,9}$/.test(cleanPhone);
          
        case 'ca':
        case 'canada':
          // Canada: +1 (416) 123-4567 (same as US format)
          return /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(phoneStr);
          
        case 'au':
        case 'australia':
          // Australia: +61 2 1234 5678, 02 1234 5678
          return /^(\+61|0)[2-478]\d{8}$/.test(cleanPhone);
          
        case 'de':
        case 'germany':
          // Germany: +49 30 12345678, 030 12345678
          return /^(\+49|0)\d{10,11}$/.test(cleanPhone);
          
        case 'fr':
        case 'france':
          // France: +33 1 23 45 67 89, 01 23 45 67 89
          return /^(\+33|0)[1-9]\d{8}$/.test(cleanPhone);
          
        case 'in':
        case 'india':
          // India: +91 98765 43210, 9876543210
          return /^(\+91|0)?[6-9]\d{9}$/.test(cleanPhone);
          
        case 'jp':
        case 'japan':
          // Japan: +81 90 1234 5678, 090-1234-5678
          return /^(\+81|0)[7-9]0\d{8}$/.test(cleanPhone);
          
        case 'cn':
        case 'china':
          // China: +86 138 0013 8000, 13800138000
          return /^(\+86|0)?1[3-9]\d{9}$/.test(cleanPhone);
          
        case 'br':
        case 'brazil':
          // Brazil: +55 11 98765-4321, (11) 98765-4321
          return /^(\+55|0)?[1-9]{2}9?[6-9]\d{7}$/.test(cleanPhone);
          
        case 'international':
          // ITU-T E.164: +[1-9][digits], 7-15 total digits
          return /^\+[1-9]\d{7,14}$/.test(cleanPhone);
          
        case 'any':
        default:
          // Flexible worldwide pattern: 7-15 digits with optional country code and formatting
          const digitsOnly = cleanPhone.replace(/^\+/, '');
          return /^[1-9]\d{6,14}$/.test(digitsOnly) && 
                 /^[\+]?[1-9][\d\-\s\(\)\.]{7,20}$/.test(phoneStr);
      }
    } catch (e) {
      return false;
    }
  },

  'IS_NUMBER': (value, min, max) => {
    try {
      const num = parseFloat(value);
      if (!isFinite(num) || isNaN(num)) return false;
      if (min !== undefined && num < parseFloat(min)) return false;
      if (max !== undefined && num > parseFloat(max)) return false;
      return true;
    } catch (e) {
      return false;
    }
  },

  'IS_INTEGER': (value) => {
    try {
      const num = parseFloat(value);
      return Number.isInteger(num);
    } catch (e) {
      return false;
    }
  },

  'IS_POSITIVE': (value) => {
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num > 0;
    } catch (e) {
      return false;
    }
  },

  'IS_NEGATIVE': (value) => {
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num < 0;
    } catch (e) {
      return false;
    }
  },

  'IS_RANGE': (value, min, max) => {
    try {
      const num = parseFloat(value);
      const minNum = parseFloat(min);
      const maxNum = parseFloat(max);
      return !isNaN(num) && !isNaN(minNum) && !isNaN(maxNum) && num >= minNum && num <= maxNum;
    } catch (e) {
      return false;
    }
  },

  'IS_DATE': (dateStr, format = 'any') => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;
      
      switch (format.toLowerCase()) {
        case 'iso':
          return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(String(dateStr));
        case 'us':
          return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(dateStr));
        case 'eu':
          return /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(String(dateStr));
        case 'any':
        default:
          return true; // Date constructor succeeded
      }
    } catch (e) {
      return false;
    }
  },

  'IS_TIME': (timeStr, format = '24') => {
    try {
      switch (format) {
        case '24':
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(String(timeStr));
        case '12':
          return /^(1[0-2]|0?[1-9]):[0-5][0-9](:[0-5][0-9])?\s?(AM|PM|am|pm)$/.test(String(timeStr));
        default:
          return false;
      }
    } catch (e) {
      return false;
    }
  },

  'IS_CREDIT_CARD': (cardNumber) => {
    try {
      // Remove spaces and dashes
      const cleaned = String(cardNumber).replace(/[\s-]/g, '');
      
      // Check if all digits and proper length
      if (!/^\d{13,19}$/.test(cleaned)) return false;
      
      // Luhn algorithm
      let sum = 0;
      let isEven = false;
      
      for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);
        
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        isEven = !isEven;
      }
      
      return sum % 10 === 0;
    } catch (e) {
      return false;
    }
  },

  'IS_ZIP_CODE': (zipCode, country = 'us') => {
    try {
      const zipStr = String(zipCode);
      
      switch (country.toLowerCase()) {
        case 'us':
          return /^\d{5}(-\d{4})?$/.test(zipStr);
        case 'uk':
          return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(zipStr);
        case 'ca':
          return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(zipStr);
        case 'de':
          return /^\d{5}$/.test(zipStr);
        default:
          return /^\d{3,10}$/.test(zipStr); // Generic: 3-10 digits
      }
    } catch (e) {
      return false;
    }
  },

  'IS_IP': (ip, version = 'any') => {
    try {
      const ipStr = String(ip);
      
      const isIPv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipStr);
      // More flexible IPv6 regex that handles compressed notation
      const isIPv6 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/.test(ipStr);
      
      switch (version.toLowerCase()) {
        case 'v4':
        case '4':
          return isIPv4;
        case 'v6':
        case '6':
          return isIPv6;
        case 'any':
        default:
          return isIPv4 || isIPv6;
      }
    } catch (e) {
      return false;
    }
  },

  'IS_MAC_ADDRESS': (mac) => {
    try {
      const macStr = String(mac);
      // Support colon, dash, and dot notation
      return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(macStr) ||
             /^([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})$/.test(macStr);
    } catch (e) {
      return false;
    }
  },

  'IS_EMPTY': (value) => {
    try {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') return value.trim() === '';
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    } catch (e) {
      return true;
    }
  },

  'IS_NOT_EMPTY': (value) => {
    try {
      return !validationFunctions['IS_EMPTY'](value);
    } catch (e) {
      return false;
    }
  },

  'IS_ALPHA': (value) => {
    try {
      return /^[A-Za-z]+$/.test(String(value));
    } catch (e) {
      return false;
    }
  },

  'IS_ALPHANUMERIC': (value) => {
    try {
      return /^[A-Za-z0-9]+$/.test(String(value));
    } catch (e) {
      return false;
    }
  },

  'IS_LENGTH': (value, min, max = null) => {
    try {
      const str = String(value);
      const length = str.length;
      const minLen = parseInt(min) || 0;
      
      if (max === null) {
        return length >= minLen;
      }
      
      const maxLen = parseInt(max);
      return length >= minLen && length <= maxLen;
    } catch (e) {
      return false;
    }
  },

  'IS_PATTERN': (value, pattern) => {
    try {
      const regex = new RegExp(String(pattern));
      return regex.test(String(value));
    } catch (e) {
      return false;
    }
  },
  
  'IS_POSTAL_CODE': (code, country = 'US') => {
    try {
      const codeStr = String(code).trim();
      const countryCode = String(country).toUpperCase();
      
      switch (countryCode) {
        case 'US':
          return /^\d{5}(-\d{4})?$/.test(codeStr);
        case 'UK':
          return /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(codeStr);
        case 'CA':
          return /^[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]$/i.test(codeStr);
        case 'FR':
          return /^\d{5}$/.test(codeStr);
        case 'DE':
          return /^\d{5}$/.test(codeStr);
        default:
          return /^\d{3,10}$/.test(codeStr);
      }
    } catch (e) {
      return false;
    }
  },
  
  'IS_NUMERIC': (value) => {
    try {
      return /^\d+$/.test(String(value));
    } catch (e) {
      return false;
    }
  },
  
  'IS_LOWERCASE': (value) => {
    try {
      const str = String(value);
      return str === str.toLowerCase() && /[a-z]/.test(str);
    } catch (e) {
      return false;
    }
  },
  
  'IS_UPPERCASE': (value) => {
    try {
      const str = String(value);
      return str === str.toUpperCase() && /[A-Z]/.test(str);
    } catch (e) {
      return false;
    }
  },
  
  'MATCHES_PATTERN': (text, pattern) => {
    try {
      const regex = new RegExp(String(pattern));
      return regex.test(String(text));
    } catch (e) {
      return false;
    }
  },

  'VALIDATE_ALL': (value, ...validators) => {
    try {
      for (const validator of validators) {
        if (!validator) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  'VALIDATE_ANY': (value, ...validators) => {
    try {
      for (const validator of validators) {
        if (validator) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  'DATATYPE': (value, type) => {
    try {
      // If type is provided, check if value matches that type
      if (type !== undefined) {
        const actualType = getDataType(value);
        return actualType === String(type).toUpperCase();
      }
      
      // If no type provided, return the actual type
      return getDataType(value);
    } catch (e) {
      return 'UNKNOWN';
    }
  }

  //TODO insert more validation functions here

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validationFunctions };
} else if (typeof window !== 'undefined') {
  window.validationFunctions = validationFunctions;
}