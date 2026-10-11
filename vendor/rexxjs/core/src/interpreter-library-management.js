/**
 * Library Management and Loading System for REXX interpreter
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
 * Handles library loading, dependency management, function registration, and library lifecycle
 * 
 * This module provides browser/Node.js compatible library management functions
 * that work with the interpreter's security, execution, and variable management systems.
 */

/**
 * Require library with dependency resolution
 * @param {string} libraryName - Name of library to load
 * @param {Set} loadingQueue - Set tracking libraries currently being loaded
 * @param {Function} checkLibraryPermissionsFn - Function to check library permissions
 * @param {Function} isLibraryLoadedFn - Function to check if library is loaded
 * @param {Function} detectAndRegisterAddressTargetsFn - Function to register ADDRESS targets
 * @param {Function} loadSingleLibraryFn - Function to load a single library
 * @param {Function} extractDependenciesFn - Function to extract library dependencies
 * @param {Map} dependencyGraph - Map tracking library dependency relationships
 * @param {Function} registerLibraryFunctionsFn - Function to register library functions
 * @returns {Promise<boolean>} True if library loaded successfully
 */
async function requireWithDependencies(libraryName, loadingQueue, checkLibraryPermissionsFn, isLibraryLoadedFn, detectAndRegisterAddressTargetsFn, loadSingleLibraryFn, extractDependenciesFn, dependencyGraph, registerLibraryFunctionsFn, parentLibraryName = null) {
  // Prevent circular dependencies
  if (loadingQueue.has(libraryName)) {
    throw new Error(`Circular dependency detected: ${libraryName} is already loading`);
  }
  
  // Security: Check library permissions
  await checkLibraryPermissionsFn(libraryName);
  
  // Check if already loaded
  if (isLibraryLoadedFn(libraryName)) {
    // Even if library is globally loaded, we need to ensure ADDRESS targets AND
    // functions/operations are registered for this interpreter instance
    detectAndRegisterAddressTargetsFn(libraryName);
    // Extract dependencies to populate metadata provider before registering functions
    await extractDependenciesFn(libraryName);
    registerLibraryFunctionsFn(libraryName);
    return true;
  }
  
  // Mark as loading to prevent cycles
  loadingQueue.add(libraryName);
  
  try {
    // Load the library first, passing parent context if it's a dependency
    await loadSingleLibraryFn(libraryName, parentLibraryName);

    // Parse dependencies from the loaded library
    const dependencies = await extractDependenciesFn(libraryName);
    
    // Track dependencies
    dependencyGraph.set(libraryName, {
      dependencies: dependencies,
      dependents: [],
      loading: false
    });
    
    // Check for and register ADDRESS targets
    detectAndRegisterAddressTargetsFn(libraryName);
    
    // Load all dependencies recursively
    for (const depName of dependencies) {
      // Pass the parent library name as context for dependency resolution
      await requireWithDependencies(depName, loadingQueue, checkLibraryPermissionsFn, isLibraryLoadedFn, detectAndRegisterAddressTargetsFn, loadSingleLibraryFn, extractDependenciesFn, dependencyGraph, registerLibraryFunctionsFn, libraryName);

      // Add reverse dependency tracking
      const depNode = dependencyGraph.get(depName) || { dependencies: [], dependents: [], loading: false };
      if (!depNode.dependents.includes(libraryName)) {
        depNode.dependents.push(libraryName);
      }
      dependencyGraph.set(depName, depNode);
    }
    
    // Register library functions after all dependencies are loaded
    registerLibraryFunctionsFn(libraryName);

    return true;
    
  } finally {
    // Remove from loading queue
    loadingQueue.delete(libraryName);
  }
}

/**
 * Check if library is already loaded
 * @param {string} libraryName - Library name to check
 * @param {Set} loadedLibraries - Set of loaded library names
 * @param {Function} getLibraryNamespaceFn - Function to get library namespace
 * @returns {boolean} True if library is loaded
 */
function isLibraryLoaded(libraryName, loadedLibraries, getLibraryNamespaceFn) {
  // Check if marked as loaded in our tracking set
  if (loadedLibraries.has(libraryName)) {
    return true;
  }
  
  // Check if the library namespace exists and has functions
  try {
    const namespace = getLibraryNamespaceFn(libraryName);
    if (namespace && typeof namespace === 'object' && Object.keys(namespace).length > 0) {
      // Mark as loaded for future checks
      loadedLibraries.add(libraryName);
      return true;
    }
  } catch (e) {
    // Namespace doesn't exist or can't be accessed
  }
  
  return false;
}

/**
 * Get dependency information for all loaded libraries
 * @param {Map} dependencyGraph - Library dependency graph
 * @returns {Object} Dependency information
 */
function getDependencyInfo(dependencyGraph) {
  const info = {};
  for (const [libName, data] of dependencyGraph.entries()) {
    info[libName] = {
      dependencies: data.dependencies || [],
      dependents: data.dependents || [],
      loading: data.loading || false
    };
  }
  return info;
}

/**
 * Get optimized library loading order based on dependencies
 * @param {Map} dependencyGraph - Library dependency graph
 * @returns {Array<string>} Ordered list of library names
 */
function getLoadOrder(dependencyGraph) {
  const visited = new Set();
  const visiting = new Set();
  const result = [];
  
  function visit(libName) {
    if (visited.has(libName)) return;
    if (visiting.has(libName)) {
      throw new Error(`Circular dependency detected involving ${libName}`);
    }
    
    visiting.add(libName);
    const node = dependencyGraph.get(libName);
    
    if (node && node.dependencies) {
      for (const dep of node.dependencies) {
        visit(dep);
      }
    }
    
    visiting.delete(libName);
    visited.add(libName);
    result.push(libName);
  }
  
  // Visit all nodes
  for (const libName of dependencyGraph.keys()) {
    visit(libName);
  }
  
  return result;
}

/**
 * Validate dependency graph has no circular dependencies
 * @param {Map} dependencyGraph - Library dependency graph
 * @returns {boolean} True if no cycles detected
 */
function validateNoCycles(dependencyGraph) {
  try {
    getLoadOrder(dependencyGraph);
    return true;
  } catch (e) {
    if (e.message.includes('Circular dependency')) {
      return false;
    }
    throw e; // Re-throw unexpected errors
  }
}

/**
 * Clear library cache and dependency graph
 * @param {Set} loadedLibraries - Set of loaded library names to clear
 * @param {Map} dependencyGraph - Library dependency graph to clear
 * @param {Set} loadingQueue - Loading queue to clear
 * @returns {number} Number of libraries cleared
 */
function clearLibraryCache(loadedLibraries, dependencyGraph, loadingQueue) {
  const count = loadedLibraries.size;
  loadedLibraries.clear();
  dependencyGraph.clear();
  loadingQueue.clear();
  console.log(`Cleared ${count} libraries from cache`);
  return count;
}

/**
 * Get cache information
 * @param {Set} loadedLibraries - Set of loaded library names
 * @param {Map} dependencyGraph - Library dependency graph
 * @param {Set} loadingQueue - Loading queue
 * @returns {Object} Cache statistics
 */
function getCacheInfo(loadedLibraries, dependencyGraph, loadingQueue) {
  return {
    loadedCount: loadedLibraries.size,
    dependencyNodes: dependencyGraph.size,
    currentlyLoading: loadingQueue.size,
    loadedLibraries: Array.from(loadedLibraries),
    loadingLibraries: Array.from(loadingQueue)
  };
}

/**
 * Detect and validate circular dependencies in loading queue
 * @param {string} libraryName - Library being loaded
 * @param {Set} loadingQueue - Current loading queue
 * @returns {boolean} True if safe to load, throws error if circular dependency
 */
function validateLoadingQueue(libraryName, loadingQueue) {
  if (loadingQueue.has(libraryName)) {
    const loadingLibs = Array.from(loadingQueue);
    throw new Error(`Circular dependency detected: ${libraryName} is already loading. Current queue: ${loadingLibs.join(', ')}`);
  }
  return true;
}

/**
 * Track library loading progress
 * @param {string} libraryName - Library name
 * @param {string} status - Loading status (loading, loaded, error)
 * @param {Map} dependencyGraph - Dependency graph to update
 * @param {*} error - Error if status is 'error'
 */
function updateLoadingStatus(libraryName, status, dependencyGraph, error = null) {
  const node = dependencyGraph.get(libraryName) || { dependencies: [], dependents: [], loading: false };
  
  switch (status) {
    case 'loading':
      node.loading = true;
      node.error = null;
      break;
    case 'loaded':
      node.loading = false;
      node.loaded = true;
      node.error = null;
      break;
    case 'error':
      node.loading = false;
      node.loaded = false;
      node.error = error;
      break;
  }
  
  dependencyGraph.set(libraryName, node);
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        requireWithDependencies,
        isLibraryLoaded,
        getDependencyInfo,
        getLoadOrder,
        validateNoCycles,
        clearLibraryCache,
        getCacheInfo,
        validateLoadingQueue,
        updateLoadingStatus
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to global window
    window.requireWithDependencies = requireWithDependencies;
    window.isLibraryLoaded = isLibraryLoaded;
    window.getDependencyInfo = getDependencyInfo;
    window.getLoadOrder = getLoadOrder;
    window.validateNoCycles = validateNoCycles;
    window.clearLibraryCache = clearLibraryCache;
    window.getCacheInfo = getCacheInfo;
    window.validateLoadingQueue = validateLoadingQueue;
    window.updateLoadingStatus = updateLoadingStatus;
}