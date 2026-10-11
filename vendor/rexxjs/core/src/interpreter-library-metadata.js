/**
 * Library Metadata Extraction Functions
 *
 * Provides wrapper methods for library metadata extraction and detection.
 * These methods delegate to require-system.js for the core implementation.
 *
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

(function() {
'use strict';

/**
 * Create library metadata utilities
 * @param {Object} requireSystem - The require-system module
 * @param {Object} interpreter - The interpreter instance
 * @returns {Object} Object with metadata utility methods
 */
function createLibraryMetadataUtils(requireSystem, interpreter) {
  return {
    async extractDependencies(libraryName) {
      return await requireSystem.extractDependencies(libraryName, interpreter);
    },

    getLibraryDetectionFunction(libraryName) {
      return requireSystem.getLibraryDetectionFunction(libraryName);
    },

    extractMetadataFunctionName(libraryCode) {
      return requireSystem.extractMetadataFunctionName(libraryCode);
    }
  };
}

// UMD pattern for both Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    createLibraryMetadataUtils
  };
} else if (typeof window !== 'undefined') {
  // Browser environment - register in registry to avoid conflicts
  if (!window.rexxModuleRegistry) {
    window.rexxModuleRegistry = new Map();
  }
  if (!window.rexxModuleRegistry.has('libraryMetadata')) {
    window.rexxModuleRegistry.set('libraryMetadata', {
      createLibraryMetadataUtils
    });
  }
}

})(); // End IIFE
