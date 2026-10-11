/**
 * Path resolution functions for REXX interpreter
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
 */

const { resolvePath } = require('./path-resolver');

const pathFunctions = {
  /**
   * PATH_RESOLVE(path, [contextScript])
   *
   * Resolves a path according to RexxJS path resolution rules.
   *
   * @param {string} pathStr - The path to resolve (supports ./, ../, root:, cwd:, absolute)
   * @param {string} contextScriptPath - Optional context script path (defaults to current script)
   * @returns {string} Absolute resolved path
   * @throws {Error} If path is ambiguous or cannot be resolved
   *
   * Examples:
   *   PATH_RESOLVE("./data.json")                    // Relative to current script
   *   PATH_RESOLVE("../lib/utils.js")                // Parent directory
   *   PATH_RESOLVE("root:config/app.json")           // From project root
   *   PATH_RESOLVE("cwd:temp.txt")                   // From current working directory
   *   PATH_RESOLVE("/usr/local/lib/module.js")       // Absolute path
   *   PATH_RESOLVE("C:/Program Files/app/lib.js")    // Windows absolute
   */
  'PATH_RESOLVE': (pathStr, contextScriptPath) => {
    // If no context provided, use the script path from the interpreter's execution context
    // This will be set by the interpreter when executing a script
    const scriptPath = contextScriptPath || (typeof __rexxScriptPath !== 'undefined' ? __rexxScriptPath : null);

    try {
      return resolvePath(pathStr, scriptPath);
    } catch (error) {
      // Re-throw with original error message
      throw error;
    }
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pathFunctions };
} else if (typeof window !== 'undefined') {
  window.pathFunctions = pathFunctions;
}
