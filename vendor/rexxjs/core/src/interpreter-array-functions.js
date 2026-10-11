/**
 * Interpreter-Aware Array Functions
 *
 * Wraps built-in array functions to make them compatible with REXX callbacks.
 * Provides REXX-specific implementations for ARRAY_MAP, ARRAY_FILTER, and related operations.
 *
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

(function() {
'use strict';

/**
 * Create interpreter-aware array functions that wrap built-in array functions
 * @param {Object} originalArrayFunctions - Original built-in array functions
 * @param {Object} interpreter - Interpreter instance with REXX context
 * @returns {Object} Interpreter-aware array functions object
 */
function createInterpreterAwareArrayFunctions(originalArrayFunctions, interpreter) {
  return {
    ...originalArrayFunctions,
    'ARRAY_FILTER': async (array, filterExpression) => {
      try {
        let arr = Array.isArray(array) ? array : JSON.parse(String(array));

        // Simple filter for non-null/undefined/empty values if no filterExpression
        if (!filterExpression) {
          return arr.filter(item => item != null && item !== '');
        }

        const expr = String(filterExpression).trim();

        // Check for arrow function syntax (param => body)
        const arrowMatch = expr.match(/^(\w+)\s*=>\s*(.+)$/);
        if (arrowMatch) {
          const body = arrowMatch[2];

          // Check if this is a JS callback (has dot notation like .includes, .length, etc.)
          // JS callbacks should be handled by the original implementation
          const hasJSSyntax = /\.\w+/.test(body); // dot notation like item.includes

          if (hasJSSyntax) {
            // Let the original implementation handle JS callbacks
            return originalArrayFunctions.ARRAY_FILTER(array, filterExpression);
          }

          // Handle as REXX lambda
          const paramName = arrowMatch[1];
          const filteredResults = [];
          for (const item of arr) {
            try {
              // Save current param variable if it exists
              const originalParam = interpreter.variables.get(paramName);
              interpreter.variables.set(paramName, item);

              // Evaluate the arrow function body
              let result = await interpreter.evaluateRexxCallbackExpression(body);

              // Restore original param variable
              if (originalParam !== undefined) {
                interpreter.variables.set(paramName, originalParam);
              } else {
                interpreter.variables.delete(paramName);
              }

              // Add item to results if condition is true
              if (!!result) {
                filteredResults.push(item);
              }
            } catch (e) {
              console.debug('Arrow function evaluation failed:', e.message);
              // Don't add item to results if evaluation failed
            }
          }
          return filteredResults;
        }

        // Check for pure-REXX callback syntax
        // Must NOT have JS syntax (=>, &&, ||, ===, !==) and MUST have REXX function calls or REXX operators
        const hasJSLogicalOps = expr.includes('&&') || expr.includes('||') || expr.includes('===') || expr.includes('!==');
        const hasRexxFunctions = expr.includes('pos(') || expr.includes('length(') ||
                                 expr.includes('upper(') || expr.includes('lower(') ||
                                 expr.includes('substr(') || expr.includes('word(');
        const hasRexxLogicalOps = (expr.includes(' & ') && !expr.includes('&&')) ||
                                 (expr.includes(' | ') && !expr.includes('||'));

        const isRexxCallback = !expr.includes('=>') &&
                              !expr.startsWith('function') &&
                              !hasJSLogicalOps &&
                              (hasRexxFunctions || hasRexxLogicalOps);

        if (isRexxCallback) {
          // Pure-REXX callback evaluation using a simpler approach
          const filteredResults = [];
          for (const item of arr) {
            try {
              // Save current item variable if it exists
              const originalItem = interpreter.variables.get('item');
              interpreter.variables.set('item', item);

              // Evaluate the REXX expression by treating it as a mini REXX script
              let result = await interpreter.evaluateRexxCallbackExpression(expr);

              // Restore original item variable
              if (originalItem !== undefined) {
                interpreter.variables.set('item', originalItem);
              } else {
                interpreter.variables.delete('item');
              }

              // Add item to results if condition is true
              if (!!result) {
                filteredResults.push(item);
              }
            } catch (e) {
              console.debug('REXX callback evaluation failed:', e.message);
              // Don't add item to results if evaluation failed
            }
          }
          return filteredResults;
        }

        // Fall back to original ARRAY_FILTER implementation for JS callbacks and object expressions
        return originalArrayFunctions.ARRAY_FILTER(array, filterExpression);
      } catch (e) {
        return [];
      }
    },

    'ARRAY_FIND': async (array, searchProperty, searchValue) => {
      try {
        // Ensure we have the right data types
        let arr = Array.isArray(array) ? array : JSON.parse(String(array));

        // Call original implementation with proper parameter resolution
        return originalArrayFunctions.ARRAY_FIND(arr, searchProperty, searchValue);
      } catch (e) {
        return null;
      }
    },

    'ARRAY_MAP': async (array, mapExpression) => {
      try {
        // Ensure we have the right data types
        let arr = Array.isArray(array) ? array : JSON.parse(String(array));

        // Simple identity mapping if no mapExpression
        if (!mapExpression) {
          return [...arr];
        }

        const expr = String(mapExpression).trim();

        // Check for arrow function syntax (param => body)
        const arrowMatch = expr.match(/^(\w+)\s*=>\s*(.+)$/);
        if (arrowMatch) {
          const body = arrowMatch[2];

          // Check if this is a JS callback (has dot notation like .includes, .length, etc.)
          // JS callbacks should be handled by the original implementation
          const hasJSSyntax = /\.\w+/.test(body); // dot notation like item.includes

          if (hasJSSyntax) {
            // Let the original implementation handle JS callbacks
            return originalArrayFunctions.ARRAY_MAP(array, mapExpression);
          }

          // Handle as REXX lambda
          const paramName = arrowMatch[1];
          const mappedResults = [];
          for (const item of arr) {
            try {
              // Save current param variable if it exists
              const originalParam = interpreter.variables.get(paramName);
              interpreter.variables.set(paramName, item);

              // Evaluate the arrow function body
              let result = await interpreter.evaluateRexxCallbackExpression(body);

              // Restore original param variable
              if (originalParam !== undefined) {
                interpreter.variables.set(paramName, originalParam);
              } else {
                interpreter.variables.delete(paramName);
              }

              mappedResults.push(result);
            } catch (e) {
              console.debug('Arrow function evaluation failed:', e.message);
              // On error, push original item
              mappedResults.push(item);
            }
          }
          return mappedResults;
        }

        // Fall back to original ARRAY_MAP implementation
        return originalArrayFunctions.ARRAY_MAP(arr, mapExpression);
      } catch (e) {
        return [];
      }
    },

    // Aliases for pipe-friendly syntax (must use interpreterAwareArrayFunctions)
    'MAP': async function(...args) {
      const funcs = createInterpreterAwareArrayFunctions(originalArrayFunctions, interpreter);
      return funcs.ARRAY_MAP(...args);
    },

    'FILTER': async function(...args) {
      const funcs = createInterpreterAwareArrayFunctions(originalArrayFunctions, interpreter);
      return funcs.ARRAY_FILTER(...args);
    }
  };
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    createInterpreterAwareArrayFunctions
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - register in registry to avoid conflicts
  if (!window.rexxModuleRegistry) {
    window.rexxModuleRegistry = new Map();
  }
  if (!window.rexxModuleRegistry.has('arrayFunctions')) {
    window.rexxModuleRegistry.set('arrayFunctions', {
      createInterpreterAwareArrayFunctions
    });
  }
}

})(); // End IIFE
