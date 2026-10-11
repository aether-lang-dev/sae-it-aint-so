'use strict';

/**
 * Path Resolution Module for RexxJS
 *
 * Implements explicit, unambiguous path resolution rules:
 * - Absolute paths: /path or C:/path
 * - Relative to script: ./path or ../path
 * - Relative to project root: root:path
 * - Relative to CWD: cwd:path
 * - Ambiguous paths: REJECTED with helpful error
 *
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 */

const path = require('path');
const fs = require('fs');

/**
 * Special constant for "no script path" situations (e.g., inline script strings)
 * Used when scripts are created dynamically or passed as strings to the parser
 */
const NO_SCRIPT_PATH = '<inline>';

/**
 * Normalize path separators to forward slashes
 * Windows accepts both / and \, we normalize to / for consistency
 */
function normalizePath(pathStr) {
  // Replace all backslashes with forward slashes
  return pathStr.replace(/\\/g, '/');
}

/**
 * Check if path is absolute (Unix or Windows)
 */
function isAbsolutePath(pathStr) {
  const normalized = normalizePath(pathStr);

  // Unix absolute: starts with /
  if (normalized.startsWith('/')) {
    return true;
  }

  // Windows absolute: starts with drive letter (C:/, D:/, etc.)
  if (/^[A-Za-z]:\//.test(normalized)) {
    return true;
  }

  // Windows UNC path: //server/share
  if (normalized.startsWith('//')) {
    return true;
  }

  return false;
}

/**
 * Find project root by searching for marker files
 * Searches upward from startDir for: .rexxroot, .git/
 */
function findProjectRoot(startDir) {
  const markers = ['.rexxroot', '.git'];

  let currentDir = path.resolve(startDir);
  const rootDir = path.parse(currentDir).root;

  while (currentDir !== rootDir) {
    // Check for each marker
    for (const marker of markers) {
      const markerPath = path.join(currentDir, marker);
      if (fs.existsSync(markerPath)) {
        return currentDir;
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null; // No project root found
}

/**
 * Resolve a path according to RexxJS path resolution rules
 *
 * @param {string} pathStr - The path to resolve
 * @param {string} contextScriptPath - Path of the script making the request (for relative paths)
 * @returns {string} Absolute resolved path
 * @throws {Error} If path is ambiguous or cannot be resolved
 */
function resolvePath(pathStr, contextScriptPath) {
  if (!pathStr || typeof pathStr !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  const normalized = normalizePath(pathStr);

  // 1. Absolute paths - return as-is (already normalized)
  if (isAbsolutePath(normalized)) {
    return path.resolve(normalized);
  }

  // 2. Relative to script: ./path or ../path
  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    if (!contextScriptPath || contextScriptPath === NO_SCRIPT_PATH) {
      throw new Error(
        `Relative path "${normalized}" cannot be resolved without a script file context.\n` +
        `When using inline script strings, use one of:\n` +
        `  - Absolute paths: /absolute/path/to/file\n` +
        `  - CWD-relative: cwd:relative/path\n` +
        `  - Root-relative: root:relative/path`
      );
    }

    const scriptDir = path.dirname(path.resolve(contextScriptPath));
    return path.resolve(scriptDir, normalized);
  }

  // 3. Project root: root:path
  if (normalized.startsWith('root:')) {
    const relativePath = normalized.slice(5); // Remove 'root:' prefix

    // Determine starting directory for root search
    const searchDir = contextScriptPath
      ? path.dirname(path.resolve(contextScriptPath))
      : process.cwd();

    const projectRoot = findProjectRoot(searchDir);

    if (!projectRoot) {
      throw new Error(
        `Cannot resolve 'root:' path - no project root found\n` +
        `Searched for: .rexxroot, .git/\n` +
        `Consider creating a .rexxroot file at your project root`
      );
    }

    return path.resolve(projectRoot, relativePath);
  }

  // 4. Current working directory: cwd:path
  if (normalized.startsWith('cwd:')) {
    const relativePath = normalized.slice(4); // Remove 'cwd:' prefix
    return path.resolve(process.cwd(), relativePath);
  }

  // 5. Ambiguous paths - REJECT with helpful error
  // Anything that doesn't match the above patterns
  throw new Error(
    `Ambiguous path in REQUIRE: "${pathStr}"\n\n` +
    `Path does not start with:\n` +
    `  - ./ or ../ (relative to script)\n` +
    `  - / or C:\\ (absolute)\n` +
    `  - root: (project root)\n` +
    `  - cwd: (current directory)\n\n` +
    `Did you mean:\n` +
    `  - "./${pathStr}" (relative to current script)?\n` +
    `  - "root:${pathStr}" (from project root)?\n` +
    `  - "cwd:${pathStr}" (from current working directory)?`
  );
}

/**
 * Export for use in interpreter as PATH_RESOLVE() function
 */
module.exports = {
  resolvePath,
  normalizePath,
  isAbsolutePath,
  findProjectRoot,
  NO_SCRIPT_PATH
};
