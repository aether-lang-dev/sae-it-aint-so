(function() {
'use strict';

/**
 * Evaluation and comparison utilities for REXX interpreter
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
 * Pure functions for value comparison, type checking, and encoding
 * 
 * This module provides browser/Node.js compatible utility functions
 * that can be used without external dependencies.
 */

/**
 * Compare two values according to REXX semantics
 * @param {*} left - Left operand
 * @param {*} right - Right operand  
 * @returns {number} -1 if left < right, 0 if equal, 1 if left > right
 */
function compareValues(left, right) {
  // Handle null/undefined comparisons - they are considered less than everything else
  if (left === null || left === undefined) {
    if (right === null || right === undefined) {
      return 0; // both null/undefined are equal
    }
    return -1; // null/undefined is less than anything else
  }
  if (right === null || right === undefined) {
    return 1; // anything is greater than null/undefined
  }
  
  // Handle numeric comparisons
  const leftNum = parseFloat(left);
  const rightNum = parseFloat(right);
  
  if (!isNaN(leftNum) && !isNaN(rightNum)) {
    return leftNum - rightNum;
  }
  
  // Handle string comparisons
  const leftStr = String(left);
  const rightStr = String(right);
  
  if (leftStr === rightStr) return 0;
  return leftStr < rightStr ? -1 : 1;
}

/**
 * Determine if a value is truthy according to REXX semantics
 * @param {*} value - Value to check
 * @returns {boolean} True if value is truthy
 */
function isTruthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '' && value !== '0' && value.toLowerCase() !== 'false';
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Check if a name looks like a function name based on common patterns
 * @param {string} name - Name to check
 * @returns {boolean} True if name looks like a function
 */
function isLikelyFunctionName(name) {
  // Check for common RPC method patterns (verbs or service methods)
  const commonRpcMethods = [
    'list', 'get', 'create', 'update', 'delete', 'check', 'find', 'search',
    'set', 'put', 'post', 'patch', 'head', 'options', 'connect', 'trace'
  ];
  
  if (commonRpcMethods.some(method => method.toLowerCase() === name.toLowerCase())) {
    return true;
  }
  
  // Check if it follows common function naming patterns
  // - Starts with verb (list, get, create, check, etc.)
  // - Contains camelCase pattern suggesting method name
  // - Ends with common action suffixes
  const verbPattern = /^(list|get|create|update|delete|check|find|search|prepare|preheat|turn|start|stop|run|execute|handle)/i;
  const camelCasePattern = /^[a-z][a-zA-Z0-9]*[A-Z]/;
  const actionSuffixPattern = /(Status|Info|Data|List|Count|Result)$/;
  
  return verbPattern.test(name) || camelCasePattern.test(name) || actionSuffixPattern.test(name);
}

/**
 * Check if a value is a numeric string (for REXX arithmetic)
 * @param {*} value - Value to check
 * @returns {boolean} True if value represents a number
 */
function isNumericString(value) {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  
  // Empty string is not numeric
  if (!value.trim()) return false;
  
  // Check if it's a valid number
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Fallback base64 encoding implementation for environments without native support
 * @param {string} string - String to encode
 * @returns {string} Base64 encoded string
 */
function basicBase64Encode(string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < string.length) {
    const a = string.charCodeAt(i++);
    const b = i < string.length ? string.charCodeAt(i++) : 0;
    const c = i < string.length ? string.charCodeAt(i++) : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < string.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < string.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
}

/**
 * Fallback base64 decoding implementation for environments without native support
 * @param {string} string - Base64 string to decode
 * @returns {string} Decoded string
 */
function basicBase64Decode(string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  string = string.replace(/[^A-Za-z0-9+/]/g, '');
  
  while (i < string.length) {
    const encoded1 = chars.indexOf(string.charAt(i++));
    const encoded2 = chars.indexOf(string.charAt(i++));
    const encoded3 = chars.indexOf(string.charAt(i++));
    const encoded4 = chars.indexOf(string.charAt(i++));
    
    const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
    
    result += String.fromCharCode((bitmap >> 16) & 255);
    if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
    if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255);
  }
  
  return result;
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        compareValues, 
        isTruthy, 
        isLikelyFunctionName, 
        isNumericString, 
        basicBase64Encode, 
        basicBase64Decode 
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - register in registry to avoid conflicts
    if (!window.rexxModuleRegistry) {
        window.rexxModuleRegistry = new Map();
    }
    if (!window.rexxModuleRegistry.has('evaluationUtils')) {
        window.rexxModuleRegistry.set('evaluationUtils', {
            compareValues,
            isTruthy,
            isLikelyFunctionName,
            isNumericString,
            basicBase64Encode,
            basicBase64Decode
        });
    }
}

})(); // End IIFE