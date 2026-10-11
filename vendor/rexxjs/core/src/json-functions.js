/**
 * JSON manipulation functions for REXX interpreter
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

const jsonFunctions = {
  'JSON_PARSE': (string) => {
    try {
      return JSON.parse(String(string));
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
  },

  'JSON_STRINGIFY': (object, indent = null) => {
    try {
      const indentValue = indent === null || indent === 'null' ? null : parseInt(indent);
      return JSON.stringify(object, null, indentValue);
    } catch (e) {
      throw new Error(`Cannot stringify object: ${e.message}`);
    }
  },

  'JSON_VALID': (string) => {
    try {
      JSON.parse(string);
      return true;
    } catch (e) {
      return false;
    }
  },

  'JSON_GET': (jsonStr, path) => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      const pathParts = String(path).split('.');
      let result = obj;
      
      for (const part of pathParts) {
        if (result === null || result === undefined) return null;
        result = result[part];
      }
      
      return result;
    } catch (e) {
      throw new Error(`Cannot get JSON path: ${e.message}`);
    }
  },
  
  'JSON_SET': (jsonStr, path, value) => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      const pathParts = String(path).split('.');
      let current = obj;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
      
      current[pathParts[pathParts.length - 1]] = value;
      return JSON.stringify(obj);
    } catch (e) {
      return jsonStr;
    }
  },
  
  'JSON_HAS': (jsonStr, path) => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      const pathParts = String(path).split('.');
      let current = obj;
      
      for (const part of pathParts) {
        if (current === null || current === undefined || !(part in current)) {
          return false;
        }
        current = current[part];
      }
      
      return true;
    } catch (e) {
      return false;
    }
  },
  
  'JSON_DELETE': (jsonStr, path) => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      const pathParts = String(path).split('.');
      let current = obj;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!(part in current)) return JSON.stringify(obj);
        current = current[part];
      }
      
      delete current[pathParts[pathParts.length - 1]];
      return JSON.stringify(obj);
    } catch (e) {
      return jsonStr;
    }
  },
  
  'JSON_KEYS': (jsonStr) => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        return Object.keys(obj);
      }
      return [];
    } catch (e) {
      return [];
    }
  },
  
  'JSON_VALUES': (jsonStr) => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        return Object.values(obj);
      }
      return [];
    } catch (e) {
      return [];
    }
  },
  
  'JSON_MERGE': (json1Str, json2Str) => {
    try {
      const obj1 = typeof json1Str === 'string' ? JSON.parse(json1Str) : json1Str;
      const obj2 = typeof json2Str === 'string' ? JSON.parse(json2Str) : json2Str;
      
      if (typeof obj1 === 'object' && typeof obj2 === 'object' && 
          obj1 !== null && obj2 !== null && 
          !Array.isArray(obj1) && !Array.isArray(obj2)) {
        return JSON.stringify({ ...obj1, ...obj2 });
      }
      
      return json1Str;
    } catch (e) {
      return json1Str;
    }
  },
  
  'JSON_FLATTEN': (jsonStr, separator = '.') => {
    try {
      const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      const result = {};
      
      const flatten = (current, prop) => {
        if (Object(current) !== current) {
          result[prop] = current;
        } else if (Array.isArray(current)) {
          current.forEach((item, index) => {
            flatten(item, prop ? `${prop}${separator}${index}` : index.toString());
          });
        } else {
          Object.keys(current).forEach(key => {
            flatten(current[key], prop ? `${prop}${separator}${key}` : key);
          });
        }
      };
      
      flatten(obj, '');
      return result;
    } catch (e) {
      return {};
    }
  },

  // JSONL (JSON Lines) Functions
  'JSONL_PARSE': (jsonlString) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      return lines.map(line => JSON.parse(line));
    } catch (e) {
      throw new Error(`Invalid JSONL: ${e.message}`);
    }
  },

  'JSONL_STRINGIFY': (arrayOfObjects) => {
    try {
      if (!Array.isArray(arrayOfObjects)) {
        throw new Error('Input must be an array');
      }
      return arrayOfObjects.map(obj => JSON.stringify(obj)).join('\n');
    } catch (e) {
      throw new Error(`Cannot stringify to JSONL: ${e.message}`);
    }
  },

  'JSONL_ADD_LINE': (jsonlString, newObject) => {
    try {
      const jsonlStr = String(jsonlString || '');
      const newLine = JSON.stringify(newObject);
      return jsonlStr === '' ? newLine : jsonlStr + '\n' + newLine;
    } catch (e) {
      throw new Error(`Cannot add line to JSONL: ${e.message}`);
    }
  },

  'JSONL_COUNT': (jsonlString) => {
    try {
      if (jsonlString === null || jsonlString === undefined) return 0;
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      return lines.length;
    } catch (e) {
      return 0;
    }
  },

  'JSONL_GET_LINE': (jsonlString, lineNumber) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      const index = parseInt(lineNumber) - 1; // 1-based indexing like REXX
      if (index < 0 || index >= lines.length) return null;
      return JSON.parse(lines[index]);
    } catch (e) {
      return null;
    }
  },

  'JSONL_FILTER': (jsonlString, filterKey, filterValue) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      const filtered = lines.filter(line => {
        try {
          const obj = JSON.parse(line);
          return obj[filterKey] === filterValue;
        } catch (e) {
          return false;
        }
      });
      return filtered.join('\n');
    } catch (e) {
      return '';
    }
  },

  'JSONL_MAP': (jsonlString, extractKey) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      return lines.map(line => {
        try {
          const obj = JSON.parse(line);
          return obj[extractKey];
        } catch (e) {
          return null;
        }
      }).filter(val => val !== null);
    } catch (e) {
      return [];
    }
  },

  'JSONL_SLICE': (jsonlString, start, end = null) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      const startIndex = Math.max(0, parseInt(start) - 1); // 1-based to 0-based
      const endIndex = end === null ? lines.length : parseInt(end);
      return lines.slice(startIndex, endIndex).join('\n');
    } catch (e) {
      return '';
    }
  },

  'JSONL_MERGE': (jsonl1, jsonl2) => {
    try {
      const str1 = String(jsonl1 || '');
      const str2 = String(jsonl2 || '');
      if (str1 === '') return str2;
      if (str2 === '') return str1;
      return str1 + '\n' + str2;
    } catch (e) {
      return jsonl1 || '';
    }
  },

  'JSONL_DISTINCT': (jsonlString, distinctKey) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      const seen = new Set();
      const distinct = lines.filter(line => {
        try {
          const obj = JSON.parse(line);
          const keyValue = distinctKey ? obj[distinctKey] : JSON.stringify(obj);
          if (seen.has(keyValue)) return false;
          seen.add(keyValue);
          return true;
        } catch (e) {
          return false;
        }
      });
      return distinct.join('\n');
    } catch (e) {
      return '';
    }
  },

  'JSONL_SORT': (jsonlString, sortKey, ascending = true) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      const objects = lines.map(line => ({
        line,
        obj: JSON.parse(line),
        sortValue: sortKey ? JSON.parse(line)[sortKey] : JSON.parse(line)
      }));
      
      objects.sort((a, b) => {
        const aVal = a.sortValue;
        const bVal = b.sortValue;
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ascending === true || ascending === 'true' ? comparison : -comparison;
      });
      
      return objects.map(item => item.line).join('\n');
    } catch (e) {
      return jsonlString;
    }
  },

  'JSONL_VALID': (jsonlString) => {
    try {
      const lines = String(jsonlString).split('\n').filter(line => line.trim() !== '');
      return lines.every(line => {
        try {
          JSON.parse(line);
          return true;
        } catch (e) {
          return false;
        }
      });
    } catch (e) {
      return false;
    }
  }

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { jsonFunctions };
} else if (typeof window !== 'undefined') {
  window.jsonFunctions = jsonFunctions;
}