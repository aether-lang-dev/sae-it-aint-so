'use strict';

/**
 * Security utilities for RexxJS interpreter
 * Extracted from interpreter.js to improve modularity
 */

// Import security module for GitHub validation and risk assessment
const security = require('./security');

/**
 * Initialize security message handlers for library permission responses
 */
function initializeSecurityHandlers() {
  // Set up global message handler for library permission responses
  if (typeof window !== 'undefined' && window.addEventListener) {
    // Browser environment - listen for permission responses
    const securityHandler = (event) => {
      if (event.data && event.data.type === 'LIBRARY_PERMISSION_RESPONSE') {
        this.handleLibraryPermissionResponse(event.data);
      }
    };
    
    window.addEventListener('message', securityHandler);
    
    // Store handler reference for cleanup if needed
    this.securityMessageHandler = securityHandler;
  }
}

/**
 * Check library permissions based on environment and security policy
 * @param {string} libraryName - Name of the library to check
 * @returns {Promise<boolean>} True if library is permitted
 */
async function checkLibraryPermissions(libraryName) {
  const env = this.detectEnvironment();
  const libraryType = this.getLibraryType(libraryName);
  
  // Apply different security policies based on environment
  switch (env) {
    case 'nodejs':
      return await checkNodeJSPermissions.call(this, libraryName, libraryType);
    case 'web-standalone':
      return await checkWebPermissions.call(this, libraryName, libraryType);
    case 'web-controlbus':
      return await checkControlBusPermissions.call(this, libraryName, libraryType);
    default:
      throw new Error(`REQUIRE not supported in environment: ${env}`);
  }
}

/**
 * Check permissions for Node.js environment
 * @param {string} libraryName - Name of the library
 * @param {string} libraryType - Type of the library
 * @returns {Promise<boolean>} True if permitted
 */
async function checkNodeJSPermissions(libraryName, libraryType) {
  // Node.js environment - more permissive for local development
  if (libraryType === 'local' || libraryType === 'npm') {
    // Local and npm modules are trusted in Node.js
    return true;
  }
  
  // Central registry libraries are pre-approved
  if (libraryName.startsWith('central:')) {
    return true;
  }
  
  // Third-party libraries: validate GitHub format if they contain a slash (username/repo)
  if (libraryType === 'third-party') {
    if (libraryName.includes('/')) {
      return await validateGitHubLibrary.call(this, libraryName);
    }
    // Simple third-party libraries (like discworld-science) are allowed in Node.js
    return true;
  }
  
  // Module libraries always require GitHub validation
  if (libraryType === 'module') {
    return await validateGitHubLibrary.call(this, libraryName);
  }
  
  // Built-in libraries are always allowed
  if (libraryType === 'builtin') {
    return true;
  }
  
  // Direct HTTPS URLs are allowed without GitHub validation
  if (libraryType === 'https-url') {
    return true;
  }
  
  throw new Error(`Unknown library type for permissions check: ${libraryName}`);
}

/**
 * Check permissions for web standalone environment
 * @param {string} libraryName - Name of the library
 * @param {string} libraryType - Type of the library
 * @returns {Promise<boolean>} True if permitted
 */
async function checkWebPermissions(libraryName, libraryType) {
  // Check if it's a registry-style library first - these are trusted
  if (this.isRegistryStyleLibrary(libraryName)) {
    return true; // Registry libraries are trusted
  }
  
  // Web standalone - medium security
  const policy = this.securityPolicy || 'default';
  
  switch (policy) {
    case 'strict':
      // Only allow central registry and built-ins
      if (libraryName.startsWith('central:') || libraryType === 'builtin') {
        return true;
      }
      throw new Error(`Library ${libraryName} blocked by strict security policy`);
      
    case 'moderate':
      // Allow central registry and known GitHub sources
      if (libraryName.startsWith('central:') || libraryType === 'builtin') {
        return true;
      }
      if (libraryType === 'module') {
        return await validateGitHubLibrary.call(this, libraryName);
      }
      if (libraryType === 'third-party') {
        // Only validate GitHub format if it contains a slash (username/repo)
        if (libraryName.includes('/')) {
          return await validateGitHubLibrary.call(this, libraryName);
        }
        // Simple third-party libraries (like r-graphing) are allowed
        return true;
      }
      // Direct HTTPS URLs are allowed in moderate policy
      if (libraryType === 'https-url') {
        return true;
      }
      throw new Error(`Library ${libraryName} blocked by moderate security policy`);
      
    case 'default':
    case 'permissive':
      // Allow all with basic validation
      if (libraryType === 'module') {
        return await validateGitHubLibrary.call(this, libraryName);
      }
      if (libraryType === 'third-party') {
        // Only validate GitHub format if it contains a slash (username/repo)
        if (libraryName.includes('/')) {
          return await validateGitHubLibrary.call(this, libraryName);
        }
        // Simple third-party libraries (like r-graphing) are allowed
        return true;
      }
      // Direct HTTPS URLs are allowed in all web policies
      if (libraryType === 'https-url') {
        return true;
      }
      return true;
      
    default:
      throw new Error(`Unknown security policy: ${policy}`);
  }
}

/**
 * Check permissions for control bus environment
 * @param {string} libraryName - Name of the library
 * @param {string} libraryType - Type of the library
 * @returns {Promise<boolean>} True if permitted
 */
async function checkControlBusPermissions(libraryName, libraryType) {
  // Control-bus environment - require director approval
  if (libraryType === 'builtin') {
    return true; // Built-ins are always allowed
  }
  
  // Check if already approved in this session
  if (this.approvedLibraries && this.approvedLibraries.has(libraryName)) {
    return true;
  }
  
  // Request permission from director
  return await requestDirectorApproval.call(this, libraryName);
}

/**
 * Validate GitHub library format and check against blocked repositories
 * @param {string} libraryName - Name of the library
 * @returns {Promise<boolean>} True if valid and not blocked
 */
async function validateGitHubLibrary(libraryName) {
  const self = this;
  return await security.validateGitHubLibrary(libraryName, function() {
    // Call the interpreter's own getBlockedRepositories method (which might be mocked)
    return self.getBlockedRepositories();
  });
}

/**
 * Get list of blocked repositories
 * @returns {Array<string>} List of blocked repository patterns
 */
function getBlockedRepositories() {
  return security.getBlockedRepositories();
}

/**
 * Request approval from director for library loading
 * @param {string} libraryName - Name of the library
 * @returns {Promise<boolean>} True if approved
 */
async function requestDirectorApproval(libraryName) {
  if (!window.parent || window.parent === window) {
    throw new Error('Control-bus mode requires iframe with parent director');
  }
  
  return new Promise((resolve, reject) => {
    const requestId = this.generateRequestId();
    const timeoutId = setTimeout(() => {
      this.pendingPermissionRequests.delete(requestId);
      reject(new Error(`Library permission request timed out for ${libraryName}`));
    }, 30000); // 30 second timeout
    
    // Store the resolver
    this.pendingPermissionRequests.set(requestId, { resolve, reject, timeoutId });
    
    // Send permission request to director
    window.parent.postMessage({
      type: 'LIBRARY_PERMISSION_REQUEST',
      requestId: requestId,
      libraryName: libraryName,
      metadata: getLibraryMetadata.call(this, libraryName)
    }, '*');
    
    console.log(`📋 Requesting permission to load library: ${libraryName}`);
  });
}

/**
 * Handle library permission response from director
 * @param {Object} response - Permission response object
 */
function handleLibraryPermissionResponse(response) {
  const { requestId, approved, reason } = response;
  const request = this.pendingPermissionRequests.get(requestId);
  
  if (!request) {
    console.warn(`Received permission response for unknown request: ${requestId}`);
    return;
  }
  
  clearTimeout(request.timeoutId);
  this.pendingPermissionRequests.delete(requestId);
  
  if (approved) {
    // Mark as approved for this session
    if (!this.approvedLibraries) {
      this.approvedLibraries = new Set();
    }
    this.approvedLibraries.add(response.libraryName);
    
    console.log(`✅ Library approved by director: ${response.libraryName}`);
    request.resolve(true);
  } else {
    console.log(`❌ Library denied by director: ${response.libraryName} - ${reason}`);
    request.reject(new Error(`Library permission denied: ${reason}`));
  }
}

/**
 * Get metadata for a library
 * @param {string} libraryName - Name of the library
 * @returns {Object} Library metadata
 */
function getLibraryMetadata(libraryName) {
  return {
    type: this.getLibraryType(libraryName),
    source: libraryName.startsWith('central:') ? 'central-registry' : 'github-direct',
    riskLevel: assessRiskLevel.call(this, libraryName)
  };
}

/**
 * Assess risk level for a library
 * @param {string} libraryName - Name of the library
 * @returns {string} Risk level (low, medium, high)
 */
function assessRiskLevel(libraryName) {
  return security.assessRiskLevel(libraryName);
}

/**
 * Set security policy for library loading
 * @param {string} policy - Security policy (strict, moderate, default, permissive)
 */
function setSecurityPolicy(policy) {
  const validPolicies = ['strict', 'moderate', 'default', 'permissive'];
  if (!validPolicies.includes(policy)) {
    throw new Error(`Invalid security policy: ${policy}. Valid options: ${validPolicies.join(', ')}`);
  }
  
  this.securityPolicy = policy;
  console.log(`🔒 Security policy set to: ${policy}`);
}

/**
 * Execute library code in a sandboxed environment
 * @param {string} libraryCode - Code to execute
 * @param {string} libraryName - Name of the library
 */
function executeLibraryCodeSandboxed(libraryCode, libraryName) {
  // Create a sandboxed execution environment
  const sandbox = createSandbox.call(this, libraryName);
  
  try {
    // Execute in sandbox with restricted access
    const func = new Function('sandbox', `
      with (sandbox) {
        ${libraryCode}
      }
    `);
    
    func(sandbox);
    
    // Verify sandbox integrity after execution
    validateSandboxIntegrity.call(this, sandbox, libraryName);
    
    console.log(`🔒 Library ${libraryName} executed in sandbox successfully`);
    
  } catch (error) {
    throw new Error(`Sandboxed execution failed for ${libraryName}: ${error.message}`);
  }
}

/**
 * Create a sandboxed execution environment
 * @param {string} libraryName - Name of the library
 * @returns {Object} Sandbox object
 */
function createSandbox(libraryName) {
  // Create restricted execution environment
  const sandbox = {
    // Allow safe globals
    Math: Math,
    JSON: JSON,
    Date: Date,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    
    // Restricted console (log only)
    console: {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    },
    
    // Library-specific namespace
    [this.getThirdPartyNamespace(libraryName.split('/').pop())]: {}
  };
  
  // Explicitly block dangerous globals
  sandbox.eval = undefined;
  sandbox.Function = undefined;
  sandbox.require = undefined;
  sandbox.process = undefined;
  sandbox.global = undefined;
  sandbox.window = undefined;
  
  return sandbox;
}

/**
 * Validate sandbox integrity after execution
 * @param {Object} sandbox - Sandbox object
 * @param {string} libraryName - Name of the library
 */
function validateSandboxIntegrity(sandbox, libraryName) {
  // Check that sandbox wasn't compromised
  const dangerous = ['eval', 'Function', 'require', 'process'];
  
  for (const prop of dangerous) {
    if (sandbox[prop] !== undefined) {
      throw new Error(`Sandbox integrity violation: ${prop} was defined by ${libraryName}`);
    }
  }
  
  // Verify expected functions were defined
  const namespace = this.getThirdPartyNamespace(libraryName.split('/').pop());
  if (!sandbox[namespace]) {
    throw new Error(`Library ${libraryName} did not define expected namespace: ${namespace}`);
  }
}

module.exports = {
  initializeSecurityHandlers,
  checkLibraryPermissions,
  checkNodeJSPermissions,
  checkWebPermissions,
  checkControlBusPermissions,
  validateGitHubLibrary,
  getBlockedRepositories,
  requestDirectorApproval,
  handleLibraryPermissionResponse,
  getLibraryMetadata,
  assessRiskLevel,
  setSecurityPolicy,
  executeLibraryCodeSandboxed,
  createSandbox,
  validateSandboxIntegrity
};