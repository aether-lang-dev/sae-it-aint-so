/**
 * REXX Callback Expression Evaluator
 *
 * Provides a simplified expression evaluator for callback contexts (e.g., array MAP, FILTER operations).
 * Supports concatenation, logical operators, comparison operators, and basic function calls.
 *
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

(function() {
'use strict';

/**
 * Evaluate REXX callback expressions
 * Supports: concatenation (||), logical operators (& for AND, | for OR), and comparisons
 *
 * @param {string} expr - The expression to evaluate
 * @param {Function} evaluatePartFn - Function to evaluate individual expression parts
 * @param {Function} isTruthyFn - Function to check truthiness
 * @param {Function} compareValuesFn - Function to compare two values
 * @returns {Promise<*>} The evaluated result
 */
async function evaluateRexxCallbackExpression(expr, evaluatePartFn, isTruthyFn, compareValuesFn) {
  // Handle concatenation operator (||) - must check before logical OR
  if (expr.includes('||')) {
    const parts = expr.split('||');
    let result = '';
    for (const part of parts) {
      const partResult = await evaluatePartFn(part.trim());
      result += String(partResult);
    }
    return result;
  }

  // Handle logical AND (&)
  if (expr.includes(' & ')) {
    const parts = expr.split(' & ');
    let result = true;
    for (const part of parts) {
      const partResult = await evaluateRexxCallbackExpression(part.trim(), evaluatePartFn, isTruthyFn, compareValuesFn);
      if (!isTruthyFn(partResult)) {
        result = false;
        break;
      }
    }
    return result;
  }

  // Handle logical OR (|)
  if (expr.includes(' | ')) {
    const parts = expr.split(' | ');
    let result = false;
    for (const part of parts) {
      const partResult = await evaluateRexxCallbackExpression(part.trim(), evaluatePartFn, isTruthyFn, compareValuesFn);
      if (isTruthyFn(partResult)) {
        result = true;
        break;
      }
    }
    return result;
  }

  // Handle comparison operators (with or without spaces)
  // Try operators in order of length to match longest first (e.g., >= before >)
  const comparisonRegexes = [
    { regex: /(.+?)\s*>=\s*(.+)/, op: '>=' },
    { regex: /(.+?)\s*<=\s*(.+)/, op: '<=' },
    { regex: /(.+?)\s*!=\s*(.+)/, op: '!=' },
    { regex: /(.+?)\s*==\s*(.+)/, op: '==' },
    { regex: /(.+?)\s*<>\s*(.+)/, op: '<>' },
    { regex: /(.+?)\s*¬=\s*(.+)/, op: '¬=' },
    { regex: /(.+?)\s*><\s*(.+)/, op: '><' },
    { regex: /(.+?)\s*>\s*(.+)/, op: '>' },
    { regex: /(.+?)\s*<\s*(.+)/, op: '<' },
    { regex: /(.+?)\s*=\s*(.+)/, op: '=' }
  ];

  for (const {regex, op} of comparisonRegexes) {
    const match = expr.match(regex);
    if (match) {
      const leftVal = await evaluatePartFn(match[1].trim());
      const rightVal = await evaluatePartFn(match[2].trim());

      switch (op) {
        case '>=':
          return compareValuesFn(leftVal, rightVal) >= 0;
        case '<=':
          return compareValuesFn(leftVal, rightVal) <= 0;
        case '>':
          return compareValuesFn(leftVal, rightVal) > 0;
        case '<':
          return compareValuesFn(leftVal, rightVal) < 0;
        case '=':
        case '==':
          return compareValuesFn(leftVal, rightVal) === 0;
        case '!=':
        case '<>':
        case '¬=':
        case '><':
          return compareValuesFn(leftVal, rightVal) !== 0;
      }
    }
  }

  // Simple expression - evaluate as single part
  return await evaluatePartFn(expr);
}

/**
 * Evaluate a single part of a REXX callback expression
 * Supports: arithmetic, function calls, quoted strings, numbers, variables
 *
 * @param {string} expr - The expression part to evaluate
 * @param {Object} context - Context object with interpreter state
 * @returns {Promise<*>} The evaluated result
 */
async function evaluateRexxExpressionPart(expr, context) {
  // Destructure context for cleaner code
  const {
    variables,
    builtInFunctions,
    operations,
    parseSimpleArgsFn,
    evaluatePartRecursiveFn
  } = context;

  const trimmed = expr.trim();

  // Check if it contains arithmetic operators (*, /, %, +, -, **)
  const hasArithmetic = /[\+\-\*\/%]/.test(trimmed) && !trimmed.match(/^['"].*['"]$/);
  if (hasArithmetic) {
    // Try to evaluate as arithmetic expression using the full expression evaluator
    try {
      const {parseExpression} = require('./parser');
      const parsedExpr = parseExpression(trimmed);
      if (parsedExpr) {
        return await context.evaluateExpressionFn(parsedExpr);
      }
    } catch (e) {
      // If parsing fails, continue with simple evaluation
    }
  }

  // Check if it's a function call with parentheses (handle nested parentheses)
  const funcNameMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\(/);
  if (funcNameMatch) {
    const funcName = funcNameMatch[1].toUpperCase();
    const startIdx = funcNameMatch[0].length - 1; // Index of opening (

    // Find matching closing parenthesis
    let parenCount = 0;
    let endIdx = -1;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = startIdx; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
      } else if (!inQuotes && char === '(') {
        parenCount++;
      } else if (!inQuotes && char === ')') {
        parenCount--;
        if (parenCount === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1 && endIdx === trimmed.length - 1) {
      // Valid function call
      const argsStr = trimmed.substring(startIdx + 1, endIdx);

      // Parse arguments
      const args = [];
      if (argsStr.trim()) {
        // Simple argument parsing - split by comma but handle quoted strings and nested parens
        const argParts = parseSimpleArgsFn(argsStr);
        for (const argPart of argParts) {
          const argValue = await evaluatePartRecursiveFn(argPart.trim());
          args.push(argValue);
        }
      }

      // Execute built-in function or operation
      if (builtInFunctions[funcName]) {
        const func = builtInFunctions[funcName];
        return await func(...args);
      }
      if (operations[funcName]) {
        const operation = operations[funcName];
        return await operation(...args);
      }
    }
  }

  // Check if it's a quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.substring(1, trimmed.length - 1);
  }

  // Check if it's a number
  if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed)) {
    return parseFloat(trimmed);
  }

  // Check if it's a variable
  if (variables.has(trimmed)) {
    return variables.get(trimmed);
  }

  // Return as literal string
  return trimmed;
}

/**
 * Parse simple comma-separated arguments
 * Handles quoted strings and nested parentheses
 *
 * @param {string} argsStr - The arguments string to parse
 * @returns {string[]} Array of argument strings
 */
function parseSimpleArguments(argsStr) {
  // Argument parser that handles comma-separated values with quoted strings and nested parentheses
  const args = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;
  let parenDepth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = null;
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
    } else if (!inQuotes && char === ',' && parenDepth === 0) {
      // Only split on comma if not inside parentheses
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    evaluateRexxCallbackExpression,
    evaluateRexxExpressionPart,
    parseSimpleArguments
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - register in registry to avoid conflicts
  if (!window.rexxModuleRegistry) {
    window.rexxModuleRegistry = new Map();
  }
  if (!window.rexxModuleRegistry.has('callbackEvaluation')) {
    window.rexxModuleRegistry.set('callbackEvaluation', {
      evaluateRexxCallbackExpression,
      evaluateRexxExpressionPart,
      parseSimpleArguments
    });
  }
}

})(); // End IIFE
