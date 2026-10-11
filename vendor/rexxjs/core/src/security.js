/**
 * Security Functions for REXX interpreter
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
 * Contains security validation, error handling, and library permission functions
 * 
 * This module provides browser/Node.js compatible security functions
 * for validating library access and creating security-related error messages.
 */

/**
 * Create a detailed error message for missing functions
 * @param {string} method - The missing function name
 * @returns {string} Formatted error message with categorization
 */
function createMissingFunctionError(method) {
    return `Function ${method} is not available: See https://rexxjs.org/functions/missing/ for help with missing functions and REQUIRE.`;
}

/**
 * Assess the risk level of a library based on its characteristics
 * @param {string} libraryName - The library name to assess
 * @returns {string} Risk level: 'low', 'medium', or 'high'
 */
function assessRiskLevel(libraryName) {
  // Simple risk assessment based on library characteristics
  if (libraryName.startsWith('central:')) {
    return 'low'; // Registry libraries are vetted
  }
  
  if (libraryName.includes('github.com/')) {
    // Check against known trusted organizations
    const trustedOrgs = ['microsoft', 'google', 'facebook', 'netflix', 'spotify'];
    const org = libraryName.split('/')[1];
    
    if (trustedOrgs.includes(org.toLowerCase())) {
      return 'low';
    }
    
    return 'medium';
  }
  
  return 'high'; // Unknown source
}

/**
 * Get the list of blocked repositories for security
 * @returns {Array<string>} Array of blocked repository paths
 */
function getBlockedRepositories() {
  // This could be loaded from a security service in production
  return [
    // Example blocked repos (empty for now)
  ];
}

/**
 * Validate a GitHub library name format and security
 * @param {string} libraryName - The GitHub library name to validate
 * @param {Function} getBlockedRepositoriesFn - Function to get blocked repositories
 * @returns {Promise<boolean>} True if valid and not blocked
 * @throws {Error} If library format is invalid or blocked
 */
async function validateGitHubLibrary(libraryName, getBlockedRepositoriesFn = getBlockedRepositories) {
  // Basic validation for GitHub libraries
  const githubPattern = /^github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(@[a-zA-Z0-9._-]+)?$/;

  // Extract the actual library path (remove central: or registry: prefix if present)
  const actualLibraryName = libraryName.replace(/^(central:|registry:)/, '');

  // Skip validation for registry: prefixed libraries - they go through registry resolution
  if (libraryName.startsWith('registry:')) {
    return true;
  }

  if (!githubPattern.test(actualLibraryName)) {
    throw new Error(`Invalid GitHub library format: ${libraryName}`);
  }
  
  // Check against known malicious repositories (if we had a blocklist)
  const blockedRepos = getBlockedRepositoriesFn();
  const repoPath = libraryName.replace(/^(github\.com\/|central:)/, '').split('@')[0];
  
  if (blockedRepos.includes(repoPath)) {
    throw new Error(`Library ${libraryName} is on security blocklist`);
  }
  
  return true;
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        createMissingFunctionError,
        assessRiskLevel,
        getBlockedRepositories,
        validateGitHubLibrary
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to global window
    window.createMissingFunctionError = createMissingFunctionError;
    window.assessRiskLevel = assessRiskLevel;
    window.getBlockedRepositories = getBlockedRepositories;
    window.validateGitHubLibrary = validateGitHubLibrary;
}