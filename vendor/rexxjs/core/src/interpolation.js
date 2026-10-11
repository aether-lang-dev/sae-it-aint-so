/**
 * Global Interpolation Configuration
 * Configurable string interpolation patterns for RexxJS
 * 
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

/**
 * Predefined interpolation patterns for common use cases
 */
const INTERPOLATION_PATTERNS = {
  // Double curly braces: {{variable}} - DEFAULT
  handlebars: {
    name: 'handlebars',
    regex: /\{\{([^}]*)\}\}/g,
    startDelim: '{{',
    endDelim: '}}',
    hasDelims: (str) => str.includes('{{'),
    extractVar: (match) => match.slice(2, -2)
  },
  
  // Dollar sign with braces: ${variable}
  shell: {
    name: 'shell',
    regex: /\$\{([^}]+)\}/g,
    startDelim: '${',
    endDelim: '}',
    hasDelims: (str) => str.includes('${'),
    extractVar: (match) => match.slice(2, -1)
  },
  
  // Percent signs: %variable%
  batch: {
    name: 'batch',
    regex: /%([^%]+)%/g,
    startDelim: '%',
    endDelim: '%',
    hasDelims: (str) => str.includes('%'),
    extractVar: (match) => match.slice(1, -1)
  },
  
  // Double dollar: $$variable$$
  doubledollar: {
    name: 'doubledollar',
    regex: /\$\$([^$]+)\$\$/g,
    startDelim: '$$',
    endDelim: '$$',
    hasDelims: (str) => str.includes('$$'),
    extractVar: (match) => match.slice(2, -2)
  }
};

/**
 * Global interpolation configuration state
 */
let currentPattern = INTERPOLATION_PATTERNS.handlebars; // Default to handlebars pattern

/**
 * Parse a pattern example with 'v' placeholder to create a pattern configuration
 * @param {string} example - Pattern example like "{{v}}", "${v}", "%v%", etc.
 * @returns {Object|null} Pattern configuration or null if invalid
 */
function parsePatternExample(example) {
  if (typeof example !== 'string' || !example.includes('v')) {
    return null;
  }
  
  const vIndex = example.indexOf('v');
  if (vIndex === -1 || vIndex === 0 || vIndex === example.length - 1) {
    return null; // 'v' must have something on both sides
  }
  
  const startDelim = example.substring(0, vIndex);
  const endDelim = example.substring(vIndex + 1);
  
  if (!startDelim || !endDelim) {
    return null; // Must have non-empty delimiters on both sides
  }
  
  // Check if this matches any existing predefined pattern
  for (const [name, config] of Object.entries(INTERPOLATION_PATTERNS)) {
    if (config.startDelim === startDelim && config.endDelim === endDelim) {
      return { ...config }; // Return a copy of the existing pattern
    }
  }
  
  // Create new custom pattern
  const patternName = `custom_${startDelim.replace(/[^a-zA-Z0-9]/g, '')}_${endDelim.replace(/[^a-zA-Z0-9]/g, '')}`;
  return createCustomPattern(patternName, startDelim, endDelim);
}

/**
 * Get the current interpolation pattern configuration
 * @returns {Object} Current pattern configuration
 */
function getCurrentPattern() {
  return currentPattern;
}

/**
 * Set the global interpolation pattern
 * @param {string|Object} pattern - Pattern name, pattern example (e.g. "{{v}}"), or custom pattern object
 * @returns {Object} The configured pattern
 */
function setInterpolationPattern(pattern) {
  if (typeof pattern === 'string') {
    // First try as predefined pattern name
    const predefinedPattern = INTERPOLATION_PATTERNS[pattern.toLowerCase()];
    if (predefinedPattern) {
      currentPattern = predefinedPattern;
      return currentPattern;
    }
    
    // Try parsing as pattern example with 'v' placeholder
    const parsedPattern = parsePatternExample(pattern);
    if (parsedPattern) {
      currentPattern = parsedPattern;
      return currentPattern;
    }
    
    throw new Error(`Unknown interpolation pattern: ${pattern}. Available patterns: ${Object.keys(INTERPOLATION_PATTERNS).join(', ')}, or provide a pattern example like "{{v}}", "\${v}", "%v%", etc.`);
  } else if (typeof pattern === 'object' && pattern !== null) {
    // Validate custom pattern object
    const required = ['name', 'regex', 'startDelim', 'endDelim', 'hasDelims', 'extractVar'];
    for (const prop of required) {
      if (!(prop in pattern)) {
        throw new Error(`Custom pattern missing required property: ${prop}`);
      }
    }
    currentPattern = { ...pattern };
  } else {
    throw new Error('Pattern must be a string name, pattern example, or pattern object');
  }
  
  return currentPattern;
}

/**
 * Reset to default handlebars pattern
 */
function resetToDefault() {
  currentPattern = INTERPOLATION_PATTERNS.handlebars;
  return currentPattern;
}

/**
 * Get all available predefined patterns
 * @returns {Object} All predefined patterns
 */
function getAvailablePatterns() {
  return { ...INTERPOLATION_PATTERNS };
}

/**
 * Interpolate variables in a string using the current pattern
 * @param {string} str - String to interpolate
 * @param {Object} variablePool - Object with variable name/value pairs
 * @returns {string} String with variables replaced
 */
function interpolate(str, variablePool) {
  if (!variablePool || typeof str !== 'string') {
    return str;
  }

  const pattern = getCurrentPattern();
  if (!pattern.hasDelims(str)) {
    return str;
  }

  return str.replace(pattern.regex, (match) => {
    const varName = pattern.extractVar(match);
    if (varName in variablePool) {
      return variablePool[varName];
    }
    return match; // Variable not found - leave as-is
  });
}

/**
 * Create a custom interpolation pattern
 * @param {string} name - Pattern name
 * @param {string} startDelim - Start delimiter (e.g., '{{')
 * @param {string} endDelim - End delimiter (e.g., '}}')
 * @returns {Object} Custom pattern configuration
 */
function createCustomPattern(name, startDelim, endDelim) {
  // Escape special regex characters in delimiters
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedStart = escapeRegex(startDelim);
  const escapedEnd = escapeRegex(endDelim);

  // For better matching, we'll use a more specific approach
  // If the end delimiter is a single character, use character class exclusion
  // Otherwise, use a more complex pattern that matches until the full end delimiter
  let regexPattern;
  if (endDelim.length === 1) {
    regexPattern = `${escapedStart}([^${escapeRegex(endDelim)}]+)${escapedEnd}`;
  } else {
    // For multi-character delimiters, use a non-greedy approach
    regexPattern = `${escapedStart}(.*?)${escapedEnd}`;
  }

  return {
    name,
    regex: new RegExp(regexPattern, 'g'),
    startDelim,
    endDelim,
    hasDelims: (str) => str.includes(startDelim),
    extractVar: (match) => match.slice(startDelim.length, -endDelim.length)
  };
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    INTERPOLATION_PATTERNS,
    getCurrentPattern,
    setInterpolationPattern,
    resetToDefault,
    getAvailablePatterns,
    createCustomPattern,
    parsePatternExample,
    interpolate
  };
} else if (typeof window !== 'undefined') {
  // Browser environment
  const InterpolationConfig = {
    INTERPOLATION_PATTERNS,
    getCurrentPattern,
    setInterpolationPattern,
    resetToDefault,
    getAvailablePatterns,
    createCustomPattern,
    parsePatternExample,
    interpolate
  };

  window.InterpolationConfig = InterpolationConfig;
}