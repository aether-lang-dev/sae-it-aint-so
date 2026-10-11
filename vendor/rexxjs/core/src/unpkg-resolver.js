/**
 * unpkg-resolver.js
 *
 * Resolves and caches npm dependencies from unpkg.com
 * Works in both Node.js and browser environments
 *
 * Copyright (c) 2025 RexxJS Project
 * Licensed under the MIT License
 */

const path = require('path');
const fs = require('fs');

/**
 * Get the cache directory for unpkg modules
 * @returns {string} Path to cache directory
 */
function getCacheDir() {
  // Determine project root (where package.json is)
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return path.join(currentDir, '.rexxjs-modules');
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback to home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  return path.join(homeDir, '.rexxjs-modules');
}

/**
 * Fetch module from unpkg
 * @param {string} moduleName - Module name (e.g., "jq-wasm")
 * @param {string} version - Module version (e.g., "1.1.0-jq-1.8.1")
 * @returns {Promise<string>} Module code
 */
async function fetchFromUnpkg(moduleName, version) {
  const url = `https://unpkg.com/${moduleName}@${version}`;

  console.log(`📦 Fetching ${moduleName}@${version} from unpkg...`);

  // Use https.get for Node.js (works in all versions, no dependencies)
  const https = require('https');

  return new Promise((resolve, reject) => {
    const fetchUrl = (targetUrl) => {
      const urlObj = new URL(targetUrl);

      https.get(targetUrl, {
        headers: {
          'User-Agent': 'RexxJS/1.0.0'
        }
      }, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://unpkg.com${res.headers.location}`;
          console.log(`  Redirected to: ${redirectUrl}`);
          fetchUrl(redirectUrl);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${moduleName}@${version}: ${res.statusCode}`));
          return;
        }

        let code = '';
        res.on('data', chunk => code += chunk);
        res.on('end', () => {
          console.log(`✓ Fetched ${moduleName}@${version} (${code.length} bytes)`);
          resolve(code);
        });
      }).on('error', reject);
    };

    fetchUrl(url);
  });
}

/**
 * Cache module to disk
 * @param {string} moduleName - Module name
 * @param {string} version - Module version
 * @param {string} code - Module code
 */
function cacheModule(moduleName, version, code) {
  const cacheDir = getCacheDir();
  const moduleDir = path.join(cacheDir, moduleName, version);

  // Create directory structure
  fs.mkdirSync(moduleDir, { recursive: true });

  const filePath = path.join(moduleDir, 'index.js');
  fs.writeFileSync(filePath, code, 'utf8');

  console.log(`💾 Cached ${moduleName}@${version} to ${filePath}`);

  return filePath;
}

/**
 * Get cached module path if it exists
 * @param {string} moduleName - Module name
 * @param {string} version - Module version
 * @returns {string|null} Path to cached module or null
 */
function getCachedModulePath(moduleName, version) {
  const cacheDir = getCacheDir();
  const filePath = path.join(cacheDir, moduleName, version, 'index.js');

  if (fs.existsSync(filePath)) {
    console.log(`✓ Found cached ${moduleName}@${version}`);
    return filePath;
  }

  return null;
}

/**
 * Resolve and load a module from unpkg
 * @param {string} moduleName - Module name
 * @param {string} version - Module version
 * @returns {Promise<any>} Loaded module
 */
async function resolveModule(moduleName, version) {
  // Check cache first
  let modulePath = getCachedModulePath(moduleName, version);

  if (!modulePath) {
    // Fetch from unpkg
    const code = await fetchFromUnpkg(moduleName, version);

    // Cache it
    modulePath = cacheModule(moduleName, version, code);
  }

  // Load the module
  const loadedModule = require(modulePath);

  console.log(`✓ Loaded ${moduleName}@${version}`);

  return loadedModule;
}

/**
 * Clear the entire cache
 */
function clearCache() {
  const cacheDir = getCacheDir();
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log(`🗑️  Cleared cache at ${cacheDir}`);
  }
}

module.exports = {
  resolveModule,
  fetchFromUnpkg,
  cacheModule,
  getCachedModulePath,
  getCacheDir,
  clearCache
};
