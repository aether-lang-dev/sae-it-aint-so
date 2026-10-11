/**
 * Library Require Wrapper Methods
 *
 * Provides context-aware wrapper methods for the require/library management system.
 * These methods create appropriate context objects and delegate to require-system.js.
 *
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

(function() {
'use strict';

/**
 * Create library require wrapper functions
 * @param {Object} requireSystem - The require-system module
 * @param {Object} interpreter - The interpreter instance (for binding methods)
 * @param {Object} libraryManagementUtils - The library management utilities module
 * @param {Object} libraryUrlUtils - The library URL utilities module
 * @returns {Object} Object with all wrapper methods
 */
function createLibraryRequireWrappers(requireSystem, interpreter, libraryManagementUtils, libraryUrlUtils) {
  return {
    async requireWithDependencies(libraryName, asClause = null) {
      const ctx = {
        libraryManagementUtils,
        loadingQueue: interpreter.loadingQueue,
        checkLibraryPermissions: interpreter.checkLibraryPermissions.bind(interpreter),
        isLibraryLoaded: interpreter.isLibraryLoaded.bind(interpreter),
        detectAndRegisterAddressTargets: (libName, asClause) => interpreter.detectAndRegisterAddressTargets(libName, asClause),
        extractDependencies: interpreter.extractDependencies.bind(interpreter),
        dependencyGraph: interpreter.dependencyGraph,
        registerLibraryFunctions: (libName, asClause) => interpreter.registerLibraryFunctions(libName, asClause),
        requireRegistryLibrary: interpreter.requireRegistryLibrary.bind(interpreter),
        isRemoteOrchestrated: interpreter.isRemoteOrchestrated.bind(interpreter),
        isBuiltinLibrary: interpreter.isBuiltinLibrary.bind(interpreter),
        requireViaCheckpoint: interpreter.requireViaCheckpoint.bind(interpreter),
        detectEnvironment: interpreter.detectEnvironment.bind(interpreter),
        requireWebStandalone: interpreter.requireWebStandalone.bind(interpreter),
        requireControlBus: interpreter.requireControlBus.bind(interpreter),
        requireNodeJS: interpreter.requireNodeJS.bind(interpreter),
        requireNodeJSModule: interpreter.requireNodeJSModule.bind(interpreter),
        loadAndExecuteLibrary: interpreter.loadAndExecuteLibrary.bind(interpreter),
        libraryUrlUtils,
        lookupPublisherRegistry: interpreter.lookupPublisherRegistry.bind(interpreter),
        lookupModuleInRegistry: interpreter.lookupModuleInRegistry.bind(interpreter),
        loadLibraryFromUrl: interpreter.loadLibraryFromUrl.bind(interpreter),
        isLocalOrNpmModule: interpreter.isLocalOrNpmModule.bind(interpreter),
        isRegistryStyleLibrary: interpreter.isRegistryStyleLibrary.bind(interpreter),
        requireRegistryStyleLibrary: interpreter.requireRegistryStyleLibrary.bind(interpreter),
        requireRemoteLibrary: interpreter.requireRemoteLibrary.bind(interpreter)
      };
      return await requireSystem.requireWithDependencies(libraryName, asClause, ctx);
    },

    async loadSingleLibrary(libraryName) {
      const ctx = {
        requireRegistryLibrary: interpreter.requireRegistryLibrary.bind(interpreter),
        isRemoteOrchestrated: interpreter.isRemoteOrchestrated.bind(interpreter),
        isBuiltinLibrary: interpreter.isBuiltinLibrary.bind(interpreter),
        requireViaCheckpoint: interpreter.requireViaCheckpoint.bind(interpreter),
        detectEnvironment: interpreter.detectEnvironment.bind(interpreter),
        requireWebStandalone: interpreter.requireWebStandalone.bind(interpreter),
        requireControlBus: interpreter.requireControlBus.bind(interpreter),
        requireNodeJS: interpreter.requireNodeJS.bind(interpreter),
        requireNodeJSModule: interpreter.requireNodeJSModule.bind(interpreter),
        loadAndExecuteLibrary: interpreter.loadAndExecuteLibrary.bind(interpreter),
        libraryUrlUtils,
        lookupPublisherRegistry: interpreter.lookupPublisherRegistry.bind(interpreter),
        lookupModuleInRegistry: interpreter.lookupModuleInRegistry.bind(interpreter),
        loadLibraryFromUrl: interpreter.loadLibraryFromUrl.bind(interpreter)
      };
      return await requireSystem.loadSingleLibrary(libraryName, ctx);
    },

    async requireNodeJS(libraryName) {
      const ctx = {
        requireNodeJSModule: interpreter.requireNodeJSModule.bind(interpreter),
        loadAndExecuteLibrary: interpreter.loadAndExecuteLibrary.bind(interpreter),
        libraryUrlUtils,
        lookupPublisherRegistry: interpreter.lookupPublisherRegistry.bind(interpreter),
        lookupModuleInRegistry: interpreter.lookupModuleInRegistry.bind(interpreter),
        loadLibraryFromUrl: interpreter.loadLibraryFromUrl.bind(interpreter),
        detectEnvironment: interpreter.detectEnvironment.bind(interpreter),
        isBuiltinLibrary: interpreter.isBuiltinLibrary.bind(interpreter),
        isLocalOrNpmModule: interpreter.isLocalOrNpmModule.bind(interpreter),
        isRegistryStyleLibrary: interpreter.isRegistryStyleLibrary.bind(interpreter),
        requireRegistryStyleLibrary: interpreter.requireRegistryStyleLibrary.bind(interpreter),
        requireRemoteLibrary: interpreter.requireRemoteLibrary.bind(interpreter)
      };
      return await requireSystem.requireNodeJS(libraryName, ctx);
    },

    /**
     * Load library from remote Git platforms (GitHub, GitLab, Azure DevOps, etc.)
     * @param {string} libraryName - Library name or URL
     * @returns {Promise<boolean>} True if library loaded successfully
     */
    async requireRemoteLibrary(libraryName) {
      const ctx = {
        loadAndExecuteLibrary: interpreter.loadAndExecuteLibrary.bind(interpreter)
      };
      return await requireSystem.requireRemoteLibrary(libraryName, ctx);
    },

    isLocalOrNpmModule(libraryName) {
      const ctx = {
        libraryUrlUtils
      };
      return requireSystem.isLocalOrNpmModule(libraryName, ctx);
    },

    /**
     * Check if library name follows registry style (namespace/module@version)
     * @param {string} libraryName - Library name to check
     * @returns {boolean} True if registry style
     */
    isRegistryStyleLibrary(libraryName) {
      return requireSystem.isRegistryStyleLibrary(libraryName);
    },

    /**
     * Resolve library through registry system
     * @param {string} libraryName - Registry-style library name (namespace/module@version)
     * @returns {Promise<boolean>} True if library loaded successfully
     */
    async requireRegistryStyleLibrary(libraryName) {
      const ctx = {
        lookupPublisherRegistry: interpreter.lookupPublisherRegistry.bind(interpreter),
        lookupModuleInRegistry: interpreter.lookupModuleInRegistry.bind(interpreter),
        loadLibraryFromUrl: interpreter.loadLibraryFromUrl.bind(interpreter),
        detectEnvironment: interpreter.detectEnvironment.bind(interpreter),
        loadAndExecuteLibrary: interpreter.loadAndExecuteLibrary.bind(interpreter),
        requireRemoteLibrary: interpreter.requireRemoteLibrary.bind(interpreter)
      };
      return await requireSystem.requireRegistryStyleLibrary(libraryName, ctx);
    }
  };
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    createLibraryRequireWrappers
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - register in registry to avoid conflicts
  if (!window.rexxModuleRegistry) {
    window.rexxModuleRegistry = new Map();
  }
  if (!window.rexxModuleRegistry.has('libraryRequireWrappers')) {
    window.rexxModuleRegistry.set('libraryRequireWrappers', {
      createLibraryRequireWrappers
    });
  }
}

})(); // End IIFE
