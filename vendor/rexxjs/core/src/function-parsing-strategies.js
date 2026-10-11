/**
 * Function parsing strategies for REXX interpreter
 * Each function can declare how it should be parsed in assignment expressions
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

const FunctionParsingStrategies = {
  // Math functions that use named parameters
  'MAX': 'FUNCTION_CALL',
  'MIN': 'FUNCTION_CALL', 
  'ABS': 'FUNCTION_CALL',
  'MATH_MAX': 'FUNCTION_CALL',
  'MATH_MIN': 'FUNCTION_CALL',
  'MATH_ABS': 'FUNCTION_CALL',
  'MATH_SUM': 'FUNCTION_CALL',
  'MATH_AVERAGE': 'FUNCTION_CALL',
  'MATH_POWER': 'FUNCTION_CALL',
  'MATH_SQRT': 'FUNCTION_CALL',
  'MATH_LOG': 'FUNCTION_CALL',
  'MATH_SIN': 'FUNCTION_CALL',
  'MATH_COS': 'FUNCTION_CALL',
  'MATH_TAN': 'FUNCTION_CALL',

  // R statistical functions (based on actual implementations)
  'R_MAX': 'FUNCTION_CALL',
  'R_MIN': 'FUNCTION_CALL',
  'R_MEDIAN': 'FUNCTION_CALL',
  'R_LENGTH': 'FUNCTION_CALL',
  'MEAN': 'FUNCTION_CALL',

  // String functions
  'UPPER': 'FUNCTION_CALL',
  'LOWER': 'FUNCTION_CALL',
  'LENGTH': 'FUNCTION_CALL',
  'SUBSTR': 'FUNCTION_CALL',
  'SUBSTRING': 'FUNCTION_CALL',

  // Date/time functions
  'DATE': 'FUNCTION_CALL',
  'TIME': 'FUNCTION_CALL',
  'NOW': 'FUNCTION_CALL',

  // Array functions
  'ARRAY_SUM': 'FUNCTION_CALL',
  'ARRAY_AVERAGE': 'FUNCTION_CALL',
  'ARRAY_LENGTH': 'FUNCTION_CALL',
  'ARRAY_MAX': 'FUNCTION_CALL',
  'ARRAY_MIN': 'FUNCTION_CALL',
  'ARRAY_SORT': 'FUNCTION_CALL',
  'ARRAY_FILTER': 'FUNCTION_CALL',
  'ARRAY_MAP': 'FUNCTION_CALL',
  'ARRAY_FIND': 'FUNCTION_CALL',
  'ARRAY_CONTAINS': 'FUNCTION_CALL',
  'ARRAY_SLICE': 'FUNCTION_CALL',
  'ARRAY_CONCAT': 'FUNCTION_CALL',
  'ARRAY_UNIQUE': 'FUNCTION_CALL',
  'ARRAY_REVERSE': 'FUNCTION_CALL',

  // JSON functions
  'JSON_PARSE': 'FUNCTION_CALL',
  'JSON_STRINGIFY': 'FUNCTION_CALL',
  'JSONL_PARSE': 'FUNCTION_CALL',

  // Conditional functions
  'IF': 'FUNCTION_CALL',

  // DOM functions (these typically use different patterns but included for completeness)
  'DOM_CLICK': 'FUNCTION_CALL',
  'DOM_TYPE': 'FUNCTION_CALL',
  'DOM_GET_TEXT': 'FUNCTION_CALL',
  'DOM_GET_ATTRIBUTE': 'FUNCTION_CALL',
  'DOM_SET_ATTRIBUTE': 'FUNCTION_CALL',
  'DOM_WAIT_FOR_ELEMENT': 'FUNCTION_CALL',
  'DOM_SCREENSHOT': 'FUNCTION_CALL',

  // Common function patterns that should be treated as function calls
  'GET': 'FUNCTION_CALL',
  'CHECK': 'FUNCTION_CALL',
  'CREATE': 'FUNCTION_CALL',
  'PREPARE': 'FUNCTION_CALL',
  'MAKE': 'FUNCTION_CALL',
  'SET': 'FUNCTION_CALL',
  'HANDLE': 'FUNCTION_CALL',
  'EXECUTE': 'FUNCTION_CALL',
  'PROCESS': 'FUNCTION_CALL',
  'UPDATE': 'FUNCTION_CALL',
  'DELETE': 'FUNCTION_CALL',
  'ADD': 'FUNCTION_CALL',
  'REMOVE': 'FUNCTION_CALL',
  'LIST': 'FUNCTION_CALL',
  'FIND': 'FUNCTION_CALL',
  'SEARCH': 'FUNCTION_CALL',

  // Data functions
  'COPY': 'FUNCTION_CALL',

  // Default strategy for unknown functions
  'DEFAULT': 'AUTO_DETECT'
};

/**
 * Get the parsing strategy for a function
 * @param {string} functionName - The function name to check
 * @returns {string} - The parsing strategy ('FUNCTION_CALL', 'CONCATENATION', 'AUTO_DETECT')
 */
function getFunctionParsingStrategy(functionName) {
  const upperName = functionName.toUpperCase();
  return FunctionParsingStrategies[upperName] || FunctionParsingStrategies.DEFAULT;
}

/**
 * Check if a function should be parsed as a function call rather than concatenation
 * @param {string} functionName - The function name to check
 * @returns {boolean} - True if it should be parsed as a function call
 */
function shouldParseAsFunction(functionName) {
  const strategy = getFunctionParsingStrategy(functionName);
  return strategy === 'FUNCTION_CALL';
}

/**
 * Check if an expression looks like a function call based on parsing strategies
 * @param {string} expression - The expression to analyze
 * @returns {boolean} - True if it should be treated as a function call
 */
function isFunctionCallExpression(expression) {
  if (typeof expression !== 'string') return false;
  
  // Check for parentheses syntax: FUNCTION(...)
  const parenMatch = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (parenMatch) {
    return shouldParseAsFunction(parenMatch[1]) || isPatternMatch(parenMatch[1]);
  }
  
  // Check for named parameter syntax: FUNCTION param=value
  const namedParamMatch = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+\w+=/);
  if (namedParamMatch) {
    return shouldParseAsFunction(namedParamMatch[1]) || isPatternMatch(namedParamMatch[1]);
  }
  
  return false;
}

/**
 * Check if a function name matches common patterns that should be treated as function calls
 * @param {string} functionName - The function name to check
 * @returns {boolean} - True if it matches a function call pattern
 */
function isPatternMatch(functionName) {
  const upperName = functionName.toUpperCase();
  
  // DOM function pattern: DOM_*
  if (upperName.startsWith('DOM_')) {
    return true;
  }
  
  // Common function word prefixes that end with word characters
  const functionPrefixes = /^(GET|CHECK|CREATE|PREPARE|MAKE|SET|HANDLE|EXECUTE|PROCESS|UPDATE|DELETE|ADD|REMOVE|LIST|FIND|SEARCH)\w*$/;
  if (functionPrefixes.test(upperName)) {
    return true;
  }
  
  // Known function prefixes (more restrictive than all caps)
  const knownPrefixes = /^(MATH_|R_|ARRAY_|JSON_|DOM_|STRING_)/;
  if (knownPrefixes.test(upperName)) {
    return true;
  }
  
  return false;
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FunctionParsingStrategies,
    getFunctionParsingStrategy,
    shouldParseAsFunction,
    isFunctionCallExpression,
    isPatternMatch
  };
} else if (typeof window !== 'undefined') {
  window.FunctionParsingStrategies = {
    FunctionParsingStrategies,
    getFunctionParsingStrategy,
    shouldParseAsFunction,
    isFunctionCallExpression,
    isPatternMatch
  };
}