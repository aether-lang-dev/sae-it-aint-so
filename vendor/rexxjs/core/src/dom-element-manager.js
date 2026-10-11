/* eslint-env browser */
'use strict';

/**
 * DOM Element Manager for RexxJS
 * Handles element references with stale element recovery
 * Based on FluentSelenium patterns
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
class DOMElementManager {
  constructor() {
    // Store element reference -> selector mappings
    this.elementSelectors = new Map();
    
    // Store element reference -> actual DOM element
    this.elementCache = new Map();
    
    // Generate unique IDs for element references
    this.nextElementId = 1;
    
    // Configuration
    this.config = {
      debug: false           // Log debug messages
    };
  }
  
  /**
   * Get a DOM element and store its reference
   * @param {string} selector - CSS selector
   * @param {Element} context - Optional context element for scoped queries
   * @returns {string} Element reference ID
   */
  getElement(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const elementRef = `dom_element_${this.nextElementId++}`;
    this.elementSelectors.set(elementRef, { selector, contextRef: null });
    this.elementCache.set(elementRef, element);
    
    if (this.config.debug) {
      console.log(`[DOM] Stored element ${elementRef} for selector: ${selector}`);
    }
    
    return elementRef;
  }
  
  /**
   * Get all matching DOM elements
   * @param {string} selector - CSS selector
   * @param {Element} context - Optional context element
   * @returns {Array<string>} Array of element reference IDs
   */
  getAllElements(selector, context = document) {
    const elements = context.querySelectorAll(selector);
    const refs = [];
    
    for (const element of elements) {
      const elementRef = `dom_element_${this.nextElementId++}`;
      this.elementSelectors.set(elementRef, { selector, contextRef: null });
      this.elementCache.set(elementRef, element);
      refs.push(elementRef);
    }
    
    if (this.config.debug) {
      console.log(`[DOM] Stored ${refs.length} elements for selector: ${selector}`);
    }
    
    return refs;
  }
  
  /**
   * Query for child element within a parent element
   * @param {string} parentRef - Parent element reference
   * @param {string} selector - Child selector
   * @returns {string} Child element reference ID
   */
  queryElement(parentRef, selector) {
    const parentElement = this.getElementFromRef(parentRef);
    const childElement = parentElement.querySelector(selector);
    
    if (!childElement) {
      throw new Error(`Child element not found: ${selector}`);
    }
    
    const childRef = `dom_element_${this.nextElementId++}`;
    this.elementSelectors.set(childRef, { selector, contextRef: parentRef });
    this.elementCache.set(childRef, childElement);
    
    return childRef;
  }
  
  /**
   * Check if an element reference is stale
   * @param {string} elementRef - Element reference ID
   * @returns {boolean} True if element is stale
   */
  isStale(elementRef) {
    const element = this.elementCache.get(elementRef);
    if (!element) return true;
    
    // Use multiple aggressive checks for stale detection
    const selectorInfo = this.elementSelectors.get(elementRef);
    // The querySelector check is not reliable for non-unique selectors
    // from getAllElements, so it has been removed. The isConnected/contains
    // checks below are more reliable.
    
    // Check if element is still connected to the DOM
    if (!element.isConnected) {
      return true;
    }
    
    // Check if element is contained in the document
    if (!document.contains(element)) {
      return true;
    }
    
    // Additional check: if parentNode is null, element is detached
    if (!element.parentNode) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Refresh a stale element using its original selector
   * @param {string} elementRef - Element reference ID
   * @returns {string} New element reference ID
   */
  refreshElement(elementRef) {
    const selectorInfo = this.elementSelectors.get(elementRef);
    if (!selectorInfo) {
      throw new Error(`No selector stored for element: ${elementRef}`);
    }
    
    // If this was a child query, refresh parent first
    let context = document;
    if (selectorInfo.contextRef) {
      if (this.isStale(selectorInfo.contextRef)) {
        const newParentRef = this.refreshElement(selectorInfo.contextRef);
        selectorInfo.contextRef = newParentRef;
      }
      context = this.getElementFromRef(selectorInfo.contextRef);
    }
    
    // Re-query for the element
    const newElement = context.querySelector(selectorInfo.selector);
    if (!newElement) {
      throw new Error(`Element not found after refresh: ${selectorInfo.selector}`);
    }
    
    // Update the cache with the new element
    this.elementCache.set(elementRef, newElement);
    
    if (this.config.debug) {
      console.log(`[DOM] Refreshed element ${elementRef}`);
    }
    
    return elementRef;
  }
  
  /**
   * Get the actual DOM element from a reference
   * @param {string} elementRef - Element reference ID
   * @returns {Element} The DOM element
   */
  getElementFromRef(elementRef) {
    const element = this.elementCache.get(elementRef);
    if (!element) {
      throw new Error(`Element reference not found: ${elementRef}`);
    }
    
    if (this.isStale(elementRef)) {
      throw new Error(`STALE_ELEMENT: Element is not attached to the DOM`);
    }
    
    return element;
  }
  
  /**
   * Execute an operation directly - no automatic retry, only RETRY_ON_STALE blocks handle stale elements
   * @param {Function} operation - Operation to execute
   * @param {string} elementRef - Element reference ID
   * @returns {*} Operation result
   */
  async executeOperation(operation, elementRef) {
    // Simply execute the operation - if element is stale, it will throw immediately
    return await operation(this.getElementFromRef(elementRef));
  }
  
  /**
   * DOM Element Operations - no automatic retry, throw immediately if stale
   */
  
  async clickElement(elementRef) {
    return this.executeOperation(element => {
      element.click();
      return true;
    }, elementRef);
  }
  
  async typeInElement(elementRef, text) {
    return this.executeOperation(element => {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, elementRef);
  }
  
  async clearElement(elementRef) {
    return this.executeOperation(element => {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, elementRef);
  }
  
  async getElementText(elementRef) {
    return this.executeOperation(element => {
      return element.textContent || element.value || '';
    }, elementRef);
  }
  
  async getElementAttribute(elementRef, attribute) {
    return this.executeOperation(element => {
      return element.getAttribute(attribute);
    }, elementRef);
  }
  
  async setElementAttribute(elementRef, attribute, value) {
    return this.executeOperation(element => {
      element.setAttribute(attribute, value);
      return true;
    }, elementRef);
  }
  
  async isElementVisible(elementRef) {
    return this.executeOperation(element => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             element.offsetParent !== null;
    }, elementRef);
  }
  
  
  /**
   * Configure DOM manager behavior
   */
  setConfig(config) {
    Object.assign(this.config, config);
  }
  
  /**
   * Clear all element references
   */
  clearAll() {
    this.elementSelectors.clear();
    this.elementCache.clear();
    this.nextElementId = 1;
  }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMElementManager;
}