/**
 * String Processing Functions for REXX interpreter
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
 * 
 * Contains string processing utilities and parameter conversion functions
 * 
 * This module provides browser/Node.js compatible string processing functions
 * for parameter conversion and browser string operations.
 */

/**
 * Convert named parameters to positional arguments based on function name
 * @param {string} functionName - Name of the function
 * @param {Object} params - Named parameters object
 * @returns {Array} Array of positional arguments
 */
function callConvertParamsToArgs(functionName, params) {
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    // Node.js environment
    const paramConverter = require('./parameter-converter');
    return paramConverter.convertParamsToArgs(functionName, params);
  } else if (typeof window !== 'undefined' && window.convertParamsToArgs) {
    // Browser environment
    return window.convertParamsToArgs(functionName, params);
  } else {
    // Fallback if parameter-converter not available
    return Object.values(params);
  }
}

/**
 * Execute browser-compatible string functions
 * @param {string} functionName - Name of the string function
 * @param {Array} args - Function arguments
 * @returns {*} Function result or null if not handled
 */
function executeBrowserStringFunction(functionName, args) {
  switch (functionName.toUpperCase()) {
    case 'WORD':
      const [str, n] = args;
      const words = String(str || '').trim().split(/\s+/).filter(w => w);
      const index = parseInt(n) - 1; // REXX uses 1-based indexing
      return index >= 0 && index < words.length ? words[index] : '';
      
    case 'WORDS':
      const text = String(args[0] || '').trim();
      return text ? text.split(/\s+/).filter(w => w).length : 0;
      
    case 'SUBWORD':
      const [sourceStr, startPos, length] = args;
      const allWords = String(sourceStr || '').trim().split(/\s+/).filter(w => w);
      const start = parseInt(startPos) - 1; // 1-based to 0-based
      const len = length !== undefined ? parseInt(length) : allWords.length - start;
      return allWords.slice(start, start + len).join(' ');
      
    case 'WORDPOS':
      const [phrase, text2, startWord] = args;
      const phraseWords = String(phrase || '').trim().split(/\s+/).filter(w => w);
      const textWords = String(text2 || '').trim().split(/\s+/).filter(w => w);
      const searchStart = startWord ? parseInt(startWord) - 1 : 0;
      
      for (let i = searchStart; i <= textWords.length - phraseWords.length; i++) {
        let match = true;
        for (let j = 0; j < phraseWords.length; j++) {
          if (textWords[i + j] !== phraseWords[j]) {
            match = false;
            break;
          }
        }
        if (match) return i + 1; // Convert back to 1-based
      }
      return 0;
      
    case 'DELWORD':
      const [delStr, delStart, delLength] = args;
      const delWords = String(delStr || '').trim().split(/\s+/).filter(w => w);
      const delStartIdx = parseInt(delStart) - 1;
      const delLen = delLength !== undefined ? parseInt(delLength) : delWords.length - delStartIdx;
      delWords.splice(delStartIdx, delLen);
      return delWords.join(' ');
      
    default:
      return null; // Function not handled here
  }
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        callConvertParamsToArgs,
        executeBrowserStringFunction
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - register in registry to avoid conflicts
    if (!window.rexxModuleRegistry) {
        window.rexxModuleRegistry = new Map();
    }
    if (!window.rexxModuleRegistry.has('stringProcessingUtils')) {
        window.rexxModuleRegistry.set('stringProcessingUtils', {
            callConvertParamsToArgs,
            executeBrowserStringFunction
        });
    }
}