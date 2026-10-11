(function() {
'use strict';

/**
 * DOM Manager and Utilities for REXX interpreter
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
 * Handles DOM element management, stale element retry logic, and browser environment setup
 * 
 * This module provides browser/Node.js compatible DOM interaction functions
 * that work with the interpreter's execution and variable management systems.
 */

/**
 * Initialize DOM manager for browser environment
 * @param {Function} domManagerSetter - Function to set domManager property
 * @returns {void}
 */
function initializeDOMManager(domManagerSetter) {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Check if DOMElementManager is available globally (browser)
    if (typeof DOMElementManager !== 'undefined') {
      const manager = new DOMElementManager();
      domManagerSetter(manager);
      console.log('DOM Element Manager initialized');
    } else {
      // Try to require it if in Node environment with jsdom
      try {
        const DOMElementManager = require('./dom-element-manager.js');
        const manager = new DOMElementManager();
        domManagerSetter(manager);
        console.log('DOM Element Manager initialized (via require)');
      } catch (e) {
        console.warn('DOM Element Manager not available');
      }
    }
  }
}

/**
 * Execute RETRY_ON_STALE blocks with automatic retry on stale elements
 * @param {Object} command - RETRY_ON_STALE command with timeout, preserveVars, body
 * @param {Function} variableGetFn - Function to get variable values
 * @param {Function} variableSetFn - Function to set variable values
 * @param {Function} variableHasFn - Function to check if variable exists
 * @param {Function} executeCommandsFn - Function to execute command lists
 * @returns {Promise<*>} Command execution result
 */
async function executeRetryOnStale(command, variableGetFn, variableSetFn, variableHasFn, executeCommandsFn) {
  const timeout = command.timeout || 10000;
  const preserveVars = command.preserveVars || [];
  const startTime = Date.now();
  
  console.log(`[RETRY_ON_STALE] Starting block with timeout=${timeout}ms`);
  
  // Save initial state of preserved variables
  const savedVars = new Map();
  preserveVars.forEach(varName => {
    if (variableHasFn(varName)) {
      savedVars.set(varName, variableGetFn(varName));
    }
  });
  
  let attemptCount = 0;
  while (Date.now() - startTime < timeout) {
    attemptCount++;
    console.log(`[RETRY_ON_STALE] Attempt ${attemptCount}`);
    
    try {
      // Restore preserved variables
      savedVars.forEach((value, varName) => {
        variableSetFn(varName, value);
      });
      
      // Execute the block
      const result = await executeCommandsFn(command.body);
      
      // Update preserved variables with final values
      preserveVars.forEach(varName => {
        if (variableHasFn(varName)) {
          savedVars.set(varName, variableGetFn(varName));
        }
      });
      
      // If we got here, the block succeeded
      console.log(`[RETRY_ON_STALE] Block succeeded on attempt ${attemptCount}`);
      return result;
      
    } catch (error) {
      console.log(`[RETRY_ON_STALE] Error caught: ${error.message}`);
      
      // Check if this is a stale element error
      if (error.message && (
          error.message.includes('STALE_ELEMENT') ||
          error.message.includes('Element is not attached to the DOM') ||
          error.message.includes('Element not found after refresh')
      )) {
        console.log(`[RETRY_ON_STALE] Stale element detected, will retry`);
        // Pause before retry to allow DOM reconstruction  
        await new Promise(resolve => setTimeout(resolve, 500));
        continue; // Retry entire block
      }
      // Re-throw non-stale errors
      console.log(`[RETRY_ON_STALE] Non-stale error, re-throwing`);
      throw error;
    }
  }
  
  // Timeout reached
  throw new Error(`RETRY_ON_STALE timeout after ${timeout}ms`);
}

/**
 * Check if DOM environment is available
 * @returns {boolean} True if DOM is available
 */
function isDOMAvailable() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if DOMElementManager is available
 * @returns {boolean} True if DOMElementManager can be instantiated
 */
function isDOMElementManagerAvailable() {
  if (typeof DOMElementManager !== 'undefined') {
    return true;
  }
  
  // Try to require it if in Node environment
  try {
    require('./dom-element-manager.js');
    return true;
  } catch (e) {
    return false;
  }
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        initializeDOMManager,
        executeRetryOnStale,
        isDOMAvailable,
        isDOMElementManagerAvailable
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - register in registry to avoid conflicts
    if (!window.rexxModuleRegistry) {
        window.rexxModuleRegistry = new Map();
    }
    if (!window.rexxModuleRegistry.has('domManager')) {
        window.rexxModuleRegistry.set('domManager', {
            initializeDOMManager,
            executeRetryOnStale,
            isDOMAvailable,
            isDOMElementManagerAvailable
        });
    }
}

})(); // End IIFE