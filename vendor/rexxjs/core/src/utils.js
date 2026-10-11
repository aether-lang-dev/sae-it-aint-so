/**
 * Shared Utility Functions for REXX interpreter
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
 * Contains commonly reused utility functions across the interpreter
 * 
 * This module provides browser/Node.js compatible utility functions
 * that are used multiple times throughout the codebase.
 */

/**
 * Generate a unique request ID
 * @returns {string} Unique request ID with timestamp and random component
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a library is a built-in library
 * @param {string} libraryName - The library name to check
 * @returns {boolean} True if library is built-in
 */
function isBuiltinLibrary(libraryName) {
  // Built-in libraries are those that have corresponding .js files in src/
  const builtinLibraries = [
    'array-functions', 'cryptography-functions', 'data-functions', 'date-time-functions',
    'dom-functions', 'excel-functions', 'file-functions', 'json-functions',
    'logic-functions', 'math-functions', 'probability-functions', 'random-functions',
    'regex-functions', 'statistics-functions', 'string-functions', 'url-functions',
    'validation-functions', 'sp-interpolation-functions', 'expectations-address',
    // R libraries
    'r-apply-string-functions', 'r-data-functions', 'r-dataframe-functions',
    'r-datetime-functions', 'r-factor-functions', 'r-graphics-functions',
    'r-logical-functions', 'r-math-functions', 'r-matrix-functions',
    'r-ml-functions', 'r-regression-functions', 'r-set-functions',
    'r-signal-functions', 'r-summary-functions', 'r-timeseries-functions'
  ];
  
  // Check for built-in libraries
  if (builtinLibraries.includes(libraryName)) {
    return true;
  }
  
  // Check for local file paths that point to built-in libraries in src/
  if (libraryName.startsWith('./src/') || libraryName.startsWith('../src/')) {
    return true;
  }
  
  return false;
}

/**
 * Detect the current execution environment
 * @returns {string} Environment type: 'nodejs', 'web-controlbus', 'web-standalone', or 'unknown'
 */
function detectEnvironment() {
  // Node.js environment takes priority (handles Jest which has both window and process)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'nodejs';
  }
  
  // Check window second (after Node.js check)
  if (typeof window !== 'undefined' && window.parent !== window) {
    return 'web-controlbus';
  }
  
  // Browser standalone
  if (typeof window !== 'undefined') {
    return 'web-standalone';  
  }
  
  return 'unknown';
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        generateRequestId,
        isBuiltinLibrary,
        detectEnvironment
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to global window
    window.generateRequestId = generateRequestId;
    window.isBuiltinLibrary = isBuiltinLibrary;
    window.detectEnvironment = detectEnvironment;
}