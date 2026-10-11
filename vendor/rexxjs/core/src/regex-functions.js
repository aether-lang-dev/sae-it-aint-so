/**
 * Regular expression functions for REXX interpreter
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

const regexFunctions = {
  'REGEX_MATCH': (string, pattern, flags = '') => {
    try {
      const regex = new RegExp(pattern, flags);
      const matches = string.match(regex);
      if (!matches) return '';
      // If global flag, return all matches as array, otherwise return first match
      return flags.includes('g') ? matches : matches[0];
    } catch (e) {
      return null; // Invalid regex patterns return null
    }
  },
  
  'REGEX_TEST': (string, pattern, flags = '') => {
    try {
      const regex = new RegExp(pattern, flags);
      return regex.test(string);
    } catch (e) {
      return false;
    }
  },
  
  'REGEX_REPLACE': (string, pattern, replacement, flags = 'g') => {
    try {
      const regex = new RegExp(pattern, flags);
      return string.replace(regex, replacement);
    } catch (e) {
      return string;
    }
  },
  
  'REGEX_SPLIT': (string, pattern, flags = '') => {
    try {
      const regex = new RegExp(pattern, flags);
      return string.split(regex);
    } catch (e) {
      return [string];
    }
  }

  //TODO insert more regex functions here

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { regexFunctions };
} else if (typeof window !== 'undefined') {
  window.regexFunctions = regexFunctions;
}