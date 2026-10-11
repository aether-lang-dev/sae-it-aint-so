/**
 * EXIT UNLESS Statement Execution
 *
 * Handles execution of EXIT UNLESS statements with condition parsing and evaluation.
 *
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

(function() {
'use strict';

/**
 * Execute EXIT UNLESS statement
 * @param {Object} command - EXIT UNLESS command object
 * @param {Object} interpreter - Interpreter instance
 * @returns {Promise<undefined>}
 */
async function executeExitUnlessStatement(command, interpreter) {
  // Parse the condition string into a condition object
  // The condition string can be:
  // - A simple comparison: "status = 200"
  // - A logical expression: "auth AND valid"
  // - A boolean variable: "success"
  // - A complex expression: "(status = 200) AND hasData AND (count > 0)"

  const conditionStr = command.condition;

  // Parse the condition using a simple parser
  const condition = parseConditionString(conditionStr);

  // Evaluate the condition
  const conditionResult = await interpreter.evaluateCondition(condition);

  // If condition is FALSE, exit with the specified code and message
  if (!conditionResult) {
    // Evaluate the message (it may contain concatenation with ||)
    let message = '';
    if (command.message.includes('||')) {
      message = await interpreter.evaluateConcatenation(command.message);
    } else {
      message = await interpreter.resolveValue(command.message);
    }

    // Check if message needs interpolation (double-quoted strings with {{...}} markers)
    if (typeof message === 'string') {
      // Get current interpolation pattern
      try {
        const interpolationModule = require('./interpolation');
        const pattern = interpolationModule.getCurrentPattern();
        if (pattern.hasDelims(message)) {
          message = await interpreter.interpolateString(message);
        }
      } catch (error) {
        // Interpolation module not available or failed - use message as-is
      }
    }

    // Output the message (only if outputHandler is available)
    if (interpreter.outputHandler && interpreter.outputHandler.output) {
      interpreter.outputHandler.output(String(message));
    }

    // Exit with the specified code
    const exitError = new Error(`Script terminated with EXIT ${command.code}`);
    exitError.isExit = true;
    exitError.exitCode = command.code;
    throw exitError;
  }
  // Otherwise, continue execution - return undefined (no result)
  return undefined;
}

/**
 * Parse condition string into a condition object
 * @param {string} conditionStr - The condition string to parse
 * @returns {Object} Parsed condition object
 */
function parseConditionString(conditionStr) {
  // Handle logical operators: AND, OR, NOT
  // Check for AND first (higher precedence than OR)
  const andParts = splitByLogicalOperator(conditionStr, 'AND');
  if (andParts.length > 1) {
    return {
      type: 'LOGICAL_AND',
      parts: andParts.map(part => parseConditionString(part.trim()))
    };
  }

  // Check for OR
  const orParts = splitByLogicalOperator(conditionStr, 'OR');
  if (orParts.length > 1) {
    return {
      type: 'LOGICAL_OR',
      parts: orParts.map(part => parseConditionString(part.trim()))
    };
  }

  // Check for NOT prefix
  const notMatch = conditionStr.trim().match(/^NOT\s+(.+)$/i);
  if (notMatch) {
    return {
      type: 'LOGICAL_NOT',
      operand: parseConditionString(notMatch[1].trim())
    };
  }

  // Remove outer parentheses if present
  let cleanCondition = conditionStr.trim();
  if (cleanCondition.startsWith('(') && cleanCondition.endsWith(')')) {
    cleanCondition = cleanCondition.substring(1, cleanCondition.length - 1).trim();
    return parseConditionString(cleanCondition);
  }

  // Check for comparison operators: =, <>, <, >, <=, >=
  const comparisonMatch = cleanCondition.match(/^(.+?)\s*([><=]+|<>)\s*(.+)$/);
  if (comparisonMatch) {
    return {
      type: 'COMPARISON',
      left: comparisonMatch[1].trim(),
      operator: comparisonMatch[2].trim(),
      right: comparisonMatch[3].trim()
    };
  }

  // Simple boolean expression (variable or literal)
  return {
    type: 'BOOLEAN',
    expression: cleanCondition
  };
}

/**
 * Split a string by a logical operator while respecting parentheses and quotes
 * @param {string} str - The string to split
 * @param {string} operator - The operator to split by (AND or OR)
 * @returns {string[]} Array of parts split by the operator
 */
function splitByLogicalOperator(str, operator) {
  // Split by logical operator while respecting parentheses and quotes
  const parts = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = '';

  const operatorRegex = new RegExp(`\\b${operator}\\b`, 'i');
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
      i++;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
      current += char;
      i++;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
      i++;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
      i++;
    } else if (!inQuotes && parenDepth === 0) {
      // Check if we're at the operator
      const remaining = str.substring(i);
      const match = remaining.match(operatorRegex);
      if (match && match.index === 0) {
        // Found operator at current position
        parts.push(current);
        current = '';
        i += operator.length;
        // Skip whitespace after operator
        while (i < str.length && str[i] === ' ') {
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      current += char;
      i++;
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts.length > 1 ? parts : [str];
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    executeExitUnlessStatement,
    parseConditionString,
    splitByLogicalOperator
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - register in registry to avoid conflicts
  if (!window.rexxModuleRegistry) {
    window.rexxModuleRegistry = new Map();
  }
  if (!window.rexxModuleRegistry.has('exitUnless')) {
    window.rexxModuleRegistry.set('exitUnless', {
      executeExitUnlessStatement,
      parseConditionString,
      splitByLogicalOperator
    });
  }
}

})(); // End IIFE
