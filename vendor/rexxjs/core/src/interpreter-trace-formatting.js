(function() {
'use strict';

/**
 * TRACE and Formatting utilities for REXX interpreter
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
 * Handles TRACE statement execution, trace output management, date/time formatting, and NUMERIC settings
 * 
 * This module provides browser/Node.js compatible trace and formatting functions
 * that work with the interpreter's execution state.
 */

/**
 * Execute TRACE statement - set trace mode
 * @param {Object} command - TRACE command with mode
 * @param {Array} traceOutput - Trace output buffer
 * @param {Function} addTraceOutputFn - Function to add trace output
 * @returns {string} New trace mode
 */
function executeTrace(command, traceOutput, addTraceOutputFn) {
  const mode = command.mode;
  
  // Add trace message about mode change BEFORE changing mode
  // This ensures TRACE OFF is captured under the old mode
  addTraceOutputFn(`TRACE ${mode}`, 'trace');
  
  // Return new mode for caller to set
  return mode;
}

/**
 * Add trace output based on current mode
 * @param {string} message - Trace message
 * @param {string} type - Trace type (instruction, assignment, call, etc.)
 * @param {number} lineNumber - Line number (optional)
 * @param {*} result - Result value (optional) 
 * @param {string} traceMode - Current trace mode
 * @param {Array} traceOutput - Trace output buffer
 */
function addTraceOutput(message, type = 'instruction', lineNumber = null, result = null, traceMode, traceOutput) {
  if (traceMode === 'OFF' && type !== 'trace') {
    return;
  }
  
  const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.sss
  let traceEntry = {
    timestamp,
    mode: traceMode,
    type,
    message,
    lineNumber
  };
  
  switch (traceMode) {
    case 'A': // All - trace all instructions
      if (result !== null) {
        traceEntry.result = result;
      }
      traceOutput.push(traceEntry);
      break;
      
    case 'R': // Results - trace instructions that produce results
      if (type === 'assignment' || type === 'function' || type === 'trace' || result !== null) {
        if (result !== null) {
          traceEntry.result = result;
        }
        traceOutput.push(traceEntry);
      }
      break;
      
    case 'I': // Intermediate - trace assignments and function calls
      if (type === 'assignment' || type === 'function' || type === 'call' || type === 'trace') {
        if (result !== null) {
          traceEntry.result = result;
        }
        traceOutput.push(traceEntry);
      }
      break;
      
    case 'O': // Output - trace SAY statements and output operations
      if (type === 'output' || type === 'say') {
        traceOutput.push(traceEntry);
      }
      break;
      
    case 'NORMAL':
    case 'N': // Normal - basic execution tracing
      if (type === 'instruction' || type === 'call' || type === 'trace') {
        traceOutput.push(traceEntry);
      }
      break;
      
    case 'OFF':
      // Special case: always capture TRACE mode changes
      if (type === 'trace') {
        traceOutput.push(traceEntry);
      }
      break;
  }
}

/**
 * Get trace output as formatted strings
 * @param {Array} traceOutput - Trace output buffer
 * @returns {Array} Array of formatted trace strings
 */
function getTraceOutput(traceOutput) {
  return traceOutput.map(entry => {
    let output = `[${entry.timestamp}] ${entry.mode}:${entry.type.charAt(0).toUpperCase()}`;
    if (entry.lineNumber) {
      output += ` ${entry.lineNumber}`;
    }
    output += ` ${entry.message}`;
    if (entry.result !== undefined) {
      output += ` => ${entry.result}`;
    }
    return output;
  });
}

/**
 * Clear trace output buffer
 * @param {Array} traceOutput - Trace output buffer
 * @returns {number} Number of entries cleared
 */
function clearTraceOutput(traceOutput) {
  const count = traceOutput.length;
  traceOutput.length = 0; // Clear array efficiently
  return count;
}

/**
 * Format date with timezone and format support
 * @param {Date} date - Date object to format
 * @param {string} timezone - Timezone ('UTC', 'local', or timezone name)
 * @param {string} format - Format string ('YYYY-MM-DD', 'MM/DD/YYYY', etc.)
 * @returns {string} Formatted date string
 */
function formatDate(date, timezone = 'UTC', format = 'YYYY-MM-DD') {
  try {
    // Convert to target timezone
    const targetDate = timezone === 'UTC' ? date : 
                       timezone === 'local' ? date : 
                       new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    
    const year = targetDate.getFullYear();
    const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const day = targetDate.getDate().toString().padStart(2, '0');
    
    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'ISO':
        return `${year}-${month}-${day}`;
      default:
        return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Fallback for unsupported timezones
    const isoDate = date.toISOString().split('T')[0];
    if (format === 'MM/DD/YYYY') {
      const [year, month, day] = isoDate.split('-');
      return `${month}/${day}/${year}`;
    }
    return isoDate;
  }
}

/**
 * Format time with timezone and format support
 * @param {Date} date - Date object to format
 * @param {string} timezone - Timezone ('UTC', 'local', or timezone name)
 * @param {string} format - Format string ('HH:MM:SS', 'HH:MM', '12H')
 * @returns {string} Formatted time string
 */
function formatTime(date, timezone = 'UTC', format = 'HH:MM:SS') {
  try {
    const options = { 
      timeZone: timezone === 'local' ? undefined : timezone,
      hour12: false 
    };
    
    switch (format) {
      case 'HH:MM:SS':
        return date.toLocaleTimeString('en-GB', options);
      case 'HH:MM':
        return date.toLocaleTimeString('en-GB', { ...options, second: undefined });
      case '12H':
        return date.toLocaleTimeString('en-US', { ...options, hour12: true });
      default:
        return date.toLocaleTimeString('en-GB', options);
    }
  } catch (e) {
    // Fallback for unsupported timezones
    return date.toTimeString().split(' ')[0];
  }
}

/**
 * Format date and time with timezone and format support
 * @param {Date} date - Date object to format
 * @param {string} timezone - Timezone ('UTC', 'local', or timezone name)
 * @param {string} format - Format string ('ISO' or others)
 * @returns {string} Formatted datetime string
 */
function formatDateTime(date, timezone = 'UTC', format = 'ISO') {
  try {
    if (format === 'ISO') {
      return timezone === 'UTC' ? date.toISOString() : 
             date.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T') + 'Z';
    }
    
    const options = { timeZone: timezone === 'local' ? undefined : timezone };
    return date.toLocaleString('en-US', options);
  } catch (e) {
    // Fallback for unsupported timezones
    return date.toISOString();
  }
}

/**
 * Set NUMERIC setting value
 * @param {string} setting - Setting name (DIGITS, FUZZ, FORM)
 * @param {*} value - Setting value
 * @param {Object} numericSettings - Numeric settings object to update
 * @returns {boolean} True if setting was updated, false if invalid
 */
function setNumericSetting(setting, value, numericSettings) {
  const settingName = setting.toUpperCase();
  
  switch (settingName) {
    case 'DIGITS':
      const digits = parseInt(value);
      if (digits >= 1 && digits <= 999999999) {
        numericSettings.digits = digits;
        return true;
      }
      break;
      
    case 'FUZZ':
      const fuzz = parseInt(value);
      if (fuzz >= 0 && fuzz < numericSettings.digits) {
        numericSettings.fuzz = fuzz;
        return true;
      }
      break;
      
    case 'FORM':
      const form = value.toUpperCase();
      if (form === 'SCIENTIFIC' || form === 'ENGINEERING') {
        numericSettings.form = form;
        return true;
      }
      break;
  }
  
  return false;
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        executeTrace,
        addTraceOutput,
        getTraceOutput,
        clearTraceOutput,
        formatDate,
        formatTime,
        formatDateTime,
        setNumericSetting
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - register in registry to avoid conflicts
    if (!window.rexxModuleRegistry) {
        window.rexxModuleRegistry = new Map();
    }
    if (!window.rexxModuleRegistry.has('traceFormatting')) {
        window.rexxModuleRegistry.set('traceFormatting', {
            executeTrace,
            addTraceOutput,
            getTraceOutput,
            clearTraceOutput,
            formatDate,
            formatTime,
            formatDateTime,
            setNumericSetting
        });
    }
}

})(); // End IIFE