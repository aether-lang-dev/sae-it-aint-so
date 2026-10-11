(function() {
'use strict';

/**
 * Error handling and SIGNAL functionality for REXX interpreter
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
 * Handles error processing, SIGNAL ON/OFF, label jumping, and error context reporting
 * 
 * This module provides browser/Node.js compatible error handling functions
 * that work with the interpreter's command execution and label management.
 */

/**
 * Handle error with REXX error processing and SIGNAL ON ERROR support
 * @param {Error} error - The error that occurred
 * @param {number} currentIndex - Current command index where error occurred
 * @param {Map} errorHandlers - Error handlers map (condition -> {label, enabled})
 * @param {Array} currentCommands - Current commands array
 * @param {Map} variables - Variables map for setting RC, ERRORTEXT, SIGL
 * @param {Object} context - Interpreter context for error reporting
 * @param {Function} jumpToLabelFn - Function to jump to labels
 * @returns {Object|false} Jump result if handled, false if unhandled
 */
async function handleError(error, currentIndex, errorHandlers, currentCommands, variables, context, jumpToLabelFn) {
  // Prevent infinite recursion by checking if we're already in an error handler
  if (context.inErrorHandler) {
    console.error('Error occurred within error handler - preventing infinite recursion:', error.message);
    throw error; // Re-throw to prevent infinite loop
  }
  
  // Capture comprehensive error context for ERROR_* functions
  const currentCommand = currentCommands && currentIndex !== undefined 
    ? currentCommands[currentIndex] 
    : null;
  
  // Create a snapshot of current variables (deep copy)
  const variablesSnapshot = new Map();
  for (const [key, value] of variables) {
    variablesSnapshot.set(key, value);
  }
  
  // Set REXX standard error variables
  let errorCode = 1; // Default error code
  let errorText = error.message;
  
  // Map specific error types to REXX error codes
  if (error.message && error.message.includes('STALE_ELEMENT')) {
    errorCode = 40; // REXX error 40: Invalid use of stem  (repurposing for DOM errors)
    errorText = 'Element is no longer attached to DOM';
  } else if (error.message && error.message.includes('Element not found')) {
    errorCode = 41; // Invalid use of stemname
    errorText = 'DOM element not found';
  } else if (error.name === 'DOMException' || (error.message.includes('DOM') && !error.message.includes('Label'))) {
    errorCode = 42; // General DOM error
    errorText = error.message;
  }
  
  // Set REXX error variables
  variables.set('RC', errorCode);
  variables.set('ERRORTEXT', errorText);
  variables.set('SIGL', currentIndex !== undefined ? currentIndex + 1 : 0);
  
  // Capture error context
  // Clean the originalError to avoid circular references (don't include sourceContext.interpreter)
  const cleanedError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    type: error.type,
    // Include sourceContext but without circular references
    sourceContext: error.sourceContext ? {
      lineNumber: error.sourceContext.lineNumber,
      sourceLine: error.sourceContext.sourceLine,
      sourceFilename: error.sourceContext.sourceFilename
      // Exclude interpreter to prevent circular reference during Jest serialization
    } : undefined
  };

  context.errorContext = {
    line: currentIndex !== undefined ? currentIndex + 1 : 0,
    command: currentCommand,
    commandText: getCommandText(currentCommand),
    variables: variablesSnapshot,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    functionName: getCurrentFunctionName(currentCommand),
    originalError: cleanedError
  };
  
  // Check if there's an active error handler for ERROR condition
  const errorHandler = errorHandlers.get('ERROR');
  
  if (errorHandler && errorHandler.enabled) {
    // Set flag to prevent recursive error handling
    context.inErrorHandler = true;
    try {
      // Jump to the error handler label and return a handled indicator
      const result = await jumpToLabelFn(errorHandler.label);
      // Return a jump indicator so the caller knows the error was handled
      return { jump: true, result };
    } finally {
      // Always clear the flag, even if error handler throws
      context.inErrorHandler = false;
    }
  } else {
    // No error handler, return false to indicate unhandled
    return false;
  }
}

/**
 * Get descriptive text for a command for error reporting
 * @param {Object} command - Command object
 * @returns {string} Descriptive text for the command
 */
function getCommandText(command) {
  if (!command) return 'Unknown command';
  
  switch (command.type) {
    case 'FUNCTION_CALL':
      const params = Object.entries(command.params || {})
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      return `${command.command} ${params}`;
      
    case 'ASSIGNMENT':
      if (command.command) {
        const params = Object.entries(command.command.params || {})
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(' ');
        return `LET ${command.variable} = ${command.command.command} ${params}`;
      }
      return `LET ${command.variable} = ${JSON.stringify(command.value)}`;
      
    case 'IF':
      return `IF ${JSON.stringify(command.condition)}`;
      
    case 'DO':
      return `DO loop`;
      
    case 'SELECT':
      return `SELECT statement`;
      
    case 'SIGNAL':
      return `SIGNAL ${command.action} ${command.condition} ${command.label || ''}`.trim();
      
    default:
      return `${command.type} command`;
  }
}

/**
 * Get function name from a command for error reporting
 * @param {Object} command - Command object
 * @returns {string} Function name or command type
 */
function getCurrentFunctionName(command) {
  if (!command) return 'Unknown';
  
  if (command.type === 'FUNCTION_CALL') {
    return command.command;
  } else if (command.type === 'ASSIGNMENT' && command.command) {
    return command.command.command;
  }
  
  return command.type;
}

/**
 * Jump to a label and continue execution from that point
 * @param {string} labelName - Label name to jump to
 * @param {Map} labels - Labels map (name -> command index)
 * @param {Array} currentCommands - Current commands array
 * @param {Function} executeCommandFn - Function to execute commands
 * @param {Function} executeCommandsFn - Function to execute command lists
 * @returns {*} Result from executing commands after the label
 */
async function jumpToLabel(labelName, labels, currentCommands, executeCommandFn, executeCommandsFn) {
  // Try exact match first, then case-insensitive match
  let labelIndex = labels.get(labelName);
  
  if (labelIndex === undefined) {
    // Try case-insensitive lookup
    const upperLabelName = labelName.toUpperCase();
    labelIndex = labels.get(upperLabelName);
  }
  
  if (labelIndex === undefined) {
    throw new Error(`Label '${labelName}' not found`);
  }
  
  // Execute the label command first (including any statement on the same line)
  const labelCommand = currentCommands[labelIndex];
  if (labelCommand && labelCommand.type === 'LABEL') {
    await executeCommandFn(labelCommand);
  }
  
  // Continue execution from after the label
  return await executeCommandsFn(currentCommands, labelIndex + 1);
}

/**
 * Discover labels in command list and populate labels map
 * @param {Array} commands - Commands to scan for labels
 * @param {Map} labels - Labels map to populate (name -> command index)
 */
function discoverLabels(commands, labels) {
  labels.clear();
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    if (command.type === 'LABEL') {
      labels.set(command.name, i);
    }
  }
}

/**
 * Set up error handler for a condition
 * @param {string} condition - Error condition (e.g., 'ERROR')
 * @param {string} action - Action ('ON' or 'OFF')
 * @param {string} label - Label to jump to on error (for 'ON' action)
 * @param {Map} errorHandlers - Error handlers map to update
 */
function setupErrorHandler(condition, action, label, errorHandlers) {
  if (action === 'ON') {
    errorHandlers.set(condition, {
      label: label,
      enabled: true
    });
  } else if (action === 'OFF') {
    errorHandlers.set(condition, {
      label: null,
      enabled: false
    });
  }
}

/**
 * Check if error should be handled by registered error handlers
 * @param {Error} error - The error that occurred
 * @param {Map} errorHandlers - Error handlers map
 * @returns {boolean} True if error matches a pattern that should be handled
 */
function shouldHandleError(error, errorHandlers) {
  return errorHandlers.size > 0 && error.message && (
    error.message.includes('STALE_ELEMENT') || 
    error.message.includes('Element not found') ||
    error.name === 'DOMException' ||
    (error.message.includes('DOM') && !error.message.includes('Label'))
  );
}

/**
 * Creates a detailed error message for missing functions
 * @param {string} method - The method name that was not found
 * @returns {string} Formatted error message
 */
function createMissingFunctionError(method) {
  // Note: This delegates to security module for consistency
  // Import is done inline to avoid circular dependencies
  try {
    const security = require('./security');
    return security.createMissingFunctionError(method);
  } catch (e) {
    // Fallback if security module not available
    return `Function '${method}' not found. Check function name and ensure required libraries are loaded with REQUIRE.`;
  }
}

/**
 * Creates an error context for better error reporting
 * @param {Error} error - The original error
 * @param {number} lineNumber - Line number where error occurred
 * @param {string} sourceLine - The source line content
 * @param {string} sourceFilename - The source filename
 * @param {Map} variables - Current variable state
 * @returns {Object} Error context object
 */
function createErrorContext(error, lineNumber, sourceLine, sourceFilename, variables) {
  return {
    line: lineNumber || 0,
    message: error.message,
    stack: error.stack,
    functionName: error.functionName || 'Unknown',
    commandText: sourceLine || '',
    timestamp: new Date().toISOString(),
    sourceFilename: sourceFilename || 'unknown',
    variables: variables || new Map()
  };
}

/**
 * Captures current error state for debugging
 * @param {Object} interpreter - The interpreter instance
 * @returns {Object} Captured error state
 */
function captureErrorState(interpreter) {
  return {
    currentLineNumber: interpreter.currentLineNumber,
    currentCommands: interpreter.currentCommands,
    variables: new Map(interpreter.variables),
    errorHandlers: new Map(interpreter.errorHandlers),
    callStack: [...(interpreter.callStack || [])],
    executionStack: [...(interpreter.executionStack || [])]
  };
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        handleError,
        getCommandText,
        getCurrentFunctionName,
        jumpToLabel,
        discoverLabels,
        setupErrorHandler,
        shouldHandleError,
        createMissingFunctionError,
        createErrorContext,
        captureErrorState
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - register in registry to avoid conflicts
    if (!window.rexxModuleRegistry) {
        window.rexxModuleRegistry = new Map();
    }
    if (!window.rexxModuleRegistry.has('errorHandling')) {
        window.rexxModuleRegistry.set('errorHandling', {
            handleError,
            getCommandText,
            getCurrentFunctionName,
            jumpToLabel,
            discoverLabels,
            setupErrorHandler,
            shouldHandleError,
            createMissingFunctionError,
            createErrorContext,
            captureErrorState
        });
    }
}

})(); // End IIFE