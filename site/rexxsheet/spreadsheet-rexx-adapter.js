/**
 * SpreadsheetRexxAdapter - Integration layer between SpreadsheetModel and RexxJS
 *
 * Responsibilities:
 * - Provide cell reference functions to RexxJS (A1(), B2(), etc.)
 * - Create spreadsheet-aware RexxJS interpreter
 * - Support function pipelines (already in RexxJS)
 * - Handle cell range references
 */

import SpreadsheetModel from './spreadsheet-model.js';
// sae: parse is RexxJS's, imported (a browser had it as a global from rexxjs.bundle.js).
import { parse } from './rexxjs.js';

class SpreadsheetRexxAdapter {
    constructor(spreadsheetModel) {
        this.model = spreadsheetModel;
        this.interpreter = null;
    }

    /**
     * Initialize RexxJS interpreter with spreadsheet context
     */
    async initializeInterpreter(RexxInterpreter) {
        // Create a custom interpreter that has access to cell references
        const self = this;

        // Create interpreter with custom output handler (suppress output)
        this.interpreter = new RexxInterpreter(null, {
            output: (text) => {
                // Suppress SAY output during cell evaluation
                // console.log('[Cell output]', text);
            }
        });

        // Inject cell reference functions dynamically
        this.injectCellReferenceFunctions();

        return this.interpreter;
    }

    /**
     * Execute setup script (page-level RexxJS code)
     * This runs once when the spreadsheet loads, making REQUIRE'd functions available to all cells
     */
    async executeSetupScript(script) {
        if (!script || script.trim() === '') {
            return { success: true, message: 'No setup script to execute' };
        }

        if (!this.interpreter) {
            throw new Error('Interpreter not initialized');
        }

        try {
            // Parse and execute the setup script
            const commands = parse(script);
            await this.interpreter.run(commands);

            return {
                success: true,
                message: 'Setup script executed successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Setup script failed: ${error.message}`
            };
        }
    }

    /**
     * Inject cell reference functions (A1, B2, etc.) into RexxJS context
     * Sets up a variable_missing callback to resolve cell references on-demand
     * Supports cross-sheet references like Sheet2.A1 (accessed as Sheet2_A1 in Rexx)
     */
    injectCellReferenceFunctions() {
        const self = this;

        // Set up a variable resolver callback for missing variables
        this.interpreter.variableResolver = function(name) {
            // Check if it's a cross-sheet reference pattern (Sheet2_A1 -> Sheet2.A1)
            // In Rexx, dots are not valid in variable names, so we use underscore
            const crossSheetMatch = name.match(/^([A-Za-z][A-Za-z0-9_]*)_([A-Z]+\d+)$/);
            if (crossSheetMatch) {
                const sheetName = crossSheetMatch[1];
                const cellRef = crossSheetMatch[2];

                // Save current active sheet
                const savedActiveSheet = self.model.activeSheetName;

                try {
                    // Temporarily switch to the target sheet
                    if (self.model.sheets.has(sheetName)) {
                        self.model.setActiveSheet(sheetName);
                        const value = self.model.getCellValue(cellRef);
                        // Try to parse as number if possible
                        const numValue = parseFloat(value);
                        return isNaN(numValue) ? value : numValue;
                    }
                } finally {
                    // Restore original active sheet
                    self.model.activeSheetName = savedActiveSheet;
                }
            }

            // Check if it's a local cell reference pattern (A1, B2, AA10, etc.)
            if (/^[A-Z]+\d+$/.test(name)) {
                const value = self.model.getCellValue(name);
                // Try to parse as number if possible
                const numValue = parseFloat(value);
                return isNaN(numValue) ? value : numValue;
            }

            // Not a cell reference - return undefined to let normal error handling occur
            return undefined;
        };
    }

    /**
     * Get a range of cells as an array
     * Example: A1:A5 returns [A1, A2, A3, A4, A5]
     */
    getCellRange(rangeRef) {
        const [start, end] = rangeRef.split(':');
        const startParsed = SpreadsheetModel.parseCellRef(start);
        const endParsed = SpreadsheetModel.parseCellRef(end);

        const startCol = SpreadsheetModel.colLetterToNumber(startParsed.col);
        const endCol = SpreadsheetModel.colLetterToNumber(endParsed.col);
        const startRow = startParsed.row;
        const endRow = endParsed.row;

        const values = [];

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const ref = SpreadsheetModel.formatCellRef(col, row);
                const value = this.model.getCellValue(ref);
                const numValue = parseFloat(value);
                values.push(isNaN(numValue) ? value : numValue);
            }
        }

        return values;
    }

    /**
     * Extract cell references from an expression
     * Returns array of cell references like ['A1', 'B2', 'C3']
     */
    extractCellReferences(expression) {
        const cellRefPattern = /\b([A-Z]+\d+)\b/g;
        const matches = expression.match(cellRefPattern);
        return matches ? [...new Set(matches)] : [];
    }

    /**
     * Evaluate a RexxJS expression in the spreadsheet context
     */
    // sae: one interpreter holds every cell's CELLRESULT, so evaluations
    // take turns: two at once (a loader that does not await setCell, a
    // cell and its dependents) overwrote each other's results.
    evaluate(expression, spreadsheetModel) {
        const turn = (this._turn || Promise.resolve()).then(() => this._evaluateNow(expression, spreadsheetModel));
        this._turn = turn.catch(() => {});
        return turn;
    }

    async _evaluateNow(expression, spreadsheetModel) {
        if (!this.interpreter) {
            throw new Error('Interpreter not initialized');
        }

        try {
            // NO PRE-INJECTION! Cell references are resolved lazily via variableResolver callback
            // This is more efficient and allows first-class interop

            // Parse and run the expression
            const commands = parse(expression);

            // Create a variable to capture the result
            // We'll wrap the expression to return a value
            let result;

            // If expression is a single line without LET, wrap it
            // sae: <= 1, not === 1: an expression of constants alone (2*3,
            // 1/0) parses to no commands at all, and showed as empty.
            if (commands.length <= 1 && !expression.trim().startsWith('LET')) {
                // It's an expression to evaluate
                const wrappedExpression = `LET CELLRESULT = ${expression}`;
                const wrappedCommands = parse(wrappedExpression);
                await this.interpreter.run(wrappedCommands);
                result = this.interpreter.getVariable('CELLRESULT');
            } else {
                // It's a statement or multi-line script
                await this.interpreter.run(commands);
                // Try to get result from a RESULT variable if set
                result = this.interpreter.getVariable('RESULT') || '';
            }

            return result;
        } catch (error) {
            throw new Error(`Expression error: ${error.message}`);
        }
    }

    /**
     * Create spreadsheet-specific functions for RexxJS
     * These can be loaded via REQUIRE or injected
     */
    getSpreadsheetFunctions() {
        const self = this;

        return {
            // SUM a range of cells
            SUM_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                return values.reduce((sum, val) => {
                    const num = parseFloat(val);
                    return sum + (isNaN(num) ? 0 : num);
                }, 0);
            },

            // AVERAGE a range of cells
            AVERAGE_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v)));
                if (numbers.length === 0) return 0;
                const sum = numbers.reduce((s, v) => s + parseFloat(v), 0);
                return sum / numbers.length;
            },

            // COUNT non-empty cells in range
            COUNT_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                return values.filter(v => v !== '' && v !== null && v !== undefined).length;
            },

            // MIN value in range
            MIN_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                return numbers.length > 0 ? Math.min(...numbers) : 0;
            },

            // MAX value in range
            MAX_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                return numbers.length > 0 ? Math.max(...numbers) : 0;
            },

            // Get cell value by reference
            CELL: function(ref) {
                const value = self.model.getCellValue(ref);
                const numValue = parseFloat(value);
                return isNaN(numValue) ? value : numValue;
            },

            // Get current row (useful in array formulas)
            ROW: function(ref) {
                const parsed = SpreadsheetModel.parseCellRef(ref);
                return parsed.row;
            },

            // Get current column (useful in array formulas)
            COLUMN: function(ref) {
                const parsed = SpreadsheetModel.parseCellRef(ref);
                return SpreadsheetModel.colLetterToNumber(parsed.col);
            },

            // MEDIAN value in range
            MEDIAN_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                if (numbers.length === 0) return 0;

                numbers.sort((a, b) => a - b);
                const mid = Math.floor(numbers.length / 2);

                if (numbers.length % 2 === 0) {
                    return (numbers[mid - 1] + numbers[mid]) / 2;
                } else {
                    return numbers[mid];
                }
            },

            // STDEV (standard deviation) of range - sample standard deviation
            STDEV_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                if (numbers.length < 2) return 0;

                const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
                const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));
                const variance = squaredDiffs.reduce((s, v) => s + v, 0) / (numbers.length - 1);

                return Math.sqrt(variance);
            },

            // STDEVP (standard deviation) of range - population standard deviation
            STDEVP_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                if (numbers.length === 0) return 0;

                const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
                const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));
                const variance = squaredDiffs.reduce((s, v) => s + v, 0) / numbers.length;

                return Math.sqrt(variance);
            },

            // PRODUCT of range
            PRODUCT_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                if (numbers.length === 0) return 0;

                return numbers.reduce((product, v) => product * v, 1);
            },

            // VAR (variance) of range - sample variance
            VAR_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                if (numbers.length < 2) return 0;

                const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
                const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));

                return squaredDiffs.reduce((s, v) => s + v, 0) / (numbers.length - 1);
            },

            // VARP (variance) of range - population variance
            VARP_RANGE: function(rangeRef) {
                const values = self.getCellRange(rangeRef);
                const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
                if (numbers.length === 0) return 0;

                const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
                const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));

                return squaredDiffs.reduce((s, v) => s + v, 0) / numbers.length;
            },

            // SUMIF - Sum cells in range that meet a condition
            SUMIF_RANGE: function(rangeRef, condition) {
                const values = self.getCellRange(rangeRef);

                // Parse condition (e.g., ">5", "=10", "<100")
                const match = condition.match(/^([><=!]+)(.+)$/);
                if (!match) {
                    throw new Error('Invalid condition format. Use: ">5", "=10", "<100", etc.');
                }

                const operator = match[1];
                const threshold = parseFloat(match[2]);

                if (isNaN(threshold)) {
                    throw new Error('Condition value must be a number');
                }

                return values.reduce((sum, val) => {
                    const num = parseFloat(val);
                    if (isNaN(num)) return sum;

                    let matches = false;
                    switch (operator) {
                        case '>': matches = num > threshold; break;
                        case '>=': matches = num >= threshold; break;
                        case '<': matches = num < threshold; break;
                        case '<=': matches = num <= threshold; break;
                        case '=': case '==': matches = num === threshold; break;
                        case '!=': case '<>': matches = num !== threshold; break;
                        default: throw new Error('Unknown operator: ' + operator);
                    }

                    return matches ? sum + num : sum;
                }, 0);
            },

            // COUNTIF - Count cells in range that meet a condition
            COUNTIF_RANGE: function(rangeRef, condition) {
                const values = self.getCellRange(rangeRef);

                // Parse condition (e.g., ">5", "=10", "<100")
                const match = condition.match(/^([><=!]+)(.+)$/);
                if (!match) {
                    throw new Error('Invalid condition format. Use: ">5", "=10", "<100", etc.');
                }

                const operator = match[1];
                const threshold = parseFloat(match[2]);

                if (isNaN(threshold)) {
                    throw new Error('Condition value must be a number');
                }

                return values.reduce((count, val) => {
                    const num = parseFloat(val);
                    if (isNaN(num)) return count;

                    let matches = false;
                    switch (operator) {
                        case '>': matches = num > threshold; break;
                        case '>=': matches = num >= threshold; break;
                        case '<': matches = num < threshold; break;
                        case '<=': matches = num <= threshold; break;
                        case '=': case '==': matches = num === threshold; break;
                        case '!=': case '<>': matches = num !== threshold; break;
                        default: throw new Error('Unknown operator: ' + operator);
                    }

                    return matches ? count + 1 : count;
                }, 0);
            },

            // Text Functions
            CONCAT: function(...args) {
                return args.join('');
            },

            LEFT: function(text, numChars) {
                return String(text).substring(0, numChars || 1);
            },

            RIGHT: function(text, numChars) {
                const str = String(text);
                return str.substring(str.length - (numChars || 1));
            },

            MID: function(text, start, numChars) {
                return String(text).substring(start - 1, start - 1 + numChars);
            },

            TRIM: function(text) {
                return String(text).trim();
            },

            UPPER: function(text) {
                return String(text).toUpperCase();
            },

            LOWER: function(text) {
                return String(text).toLowerCase();
            },

            LEN: function(text) {
                return String(text).length;
            },

            REPLACE_TEXT: function(text, oldText, newText) {
                return String(text).split(oldText).join(newText);
            },

            FIND_TEXT: function(findText, withinText, startPos = 1) {
                const index = String(withinText).indexOf(findText, startPos - 1);
                return index === -1 ? 0 : index + 1; // 1-based index
            },

            SUBSTITUTE: function(text, oldText, newText, instanceNum) {
                const str = String(text);
                if (instanceNum === undefined) {
                    return str.split(oldText).join(newText);
                }
                const parts = str.split(oldText);
                if (instanceNum > 0 && instanceNum <= parts.length - 1) {
                    parts[instanceNum - 1] = parts[instanceNum - 1] + newText + parts[instanceNum].substring(oldText.length);
                    parts.splice(instanceNum, 1);
                }
                return parts.join(oldText);
            },

            REPEAT_TEXT: function(text, numTimes) {
                return String(text).repeat(numTimes || 0);
            },

            TEXT_REVERSE: function(text) {
                return String(text).split('').reverse().join('');
            },

            // Date/Time Functions
            NOW: function() {
                return new Date().toISOString();
            },

            TODAY: function() {
                return new Date().toISOString().split('T')[0];
            },

            DATE: function(year, month, day) {
                return new Date(year, month - 1, day).toISOString().split('T')[0];
            },

            TIME: function(hour, minute, second) {
                const date = new Date();
                date.setHours(hour, minute, second || 0);
                return date.toTimeString().split(' ')[0];
            },

            YEAR: function(dateStr) {
                return new Date(dateStr).getFullYear();
            },

            MONTH: function(dateStr) {
                return new Date(dateStr).getMonth() + 1; // 1-based
            },

            DAY: function(dateStr) {
                return new Date(dateStr).getDate();
            },

            HOUR: function(dateStr) {
                return new Date(dateStr).getHours();
            },

            MINUTE: function(dateStr) {
                return new Date(dateStr).getMinutes();
            },

            SECOND: function(dateStr) {
                return new Date(dateStr).getSeconds();
            },

            WEEKDAY: function(dateStr) {
                return new Date(dateStr).getDay() + 1; // 1=Sunday, 7=Saturday
            },

            DAYS_BETWEEN: function(date1, date2) {
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                const diffTime = Math.abs(d2 - d1);
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            },

            ADD_DAYS: function(dateStr, days) {
                const date = new Date(dateStr);
                date.setDate(date.getDate() + days);
                return date.toISOString().split('T')[0];
            },

            ADD_MONTHS: function(dateStr, months) {
                const date = new Date(dateStr);
                date.setMonth(date.getMonth() + months);
                return date.toISOString().split('T')[0];
            },

            ADD_YEARS: function(dateStr, years) {
                const date = new Date(dateStr);
                date.setFullYear(date.getFullYear() + years);
                return date.toISOString().split('T')[0];
            },

            FORMAT_DATE: function(dateStr, format) {
                const date = new Date(dateStr);
                // Simple format replacements
                let result = format || 'YYYY-MM-DD';
                result = result.replace('YYYY', date.getFullYear());
                result = result.replace('MM', String(date.getMonth() + 1).padStart(2, '0'));
                result = result.replace('DD', String(date.getDate()).padStart(2, '0'));
                result = result.replace('HH', String(date.getHours()).padStart(2, '0'));
                result = result.replace('mm', String(date.getMinutes()).padStart(2, '0'));
                result = result.replace('ss', String(date.getSeconds()).padStart(2, '0'));
                return result;
            }
        };
    }

    /**
     * Install spreadsheet functions into the interpreter
     */
    installSpreadsheetFunctions() {
        const functions = this.getSpreadsheetFunctions();

        // Register functions in the interpreter's builtin functions
        // This makes them available for function calls
        if (!this.interpreter.builtinFunctions) {
            this.interpreter.builtinFunctions = {};
        }

        Object.entries(functions).forEach(([name, func]) => {
            // Register in builtin functions
            this.interpreter.builtinFunctions[name] = func;
        });
    }

    /**
     * Install numpy functions (via pyodide) into the interpreter
     * Makes real numpy functions available in spreadsheet expressions
     */
    async installNumpyFunctions() {
        if (!this.interpreter) {
            throw new Error('Interpreter not initialized');
        }

        try {
            // Load numpy-via-pyoide module
            // In browser, assume it's loaded globally or via script tag
            let numpyFunctions;

            if (typeof window !== 'undefined' && window.numpy) {
                // Browser environment - numpy loaded via script tag
                numpyFunctions = window.numpy;
            } else if (typeof require !== 'undefined') {
                // Node.js environment
                const numpyPath = '../../../extras/functions/numpy-via-pyoide/numpy.js';
                numpyFunctions = require(numpyPath);
            } else {
                console.warn('NumPy functions not available - load numpy.js via script tag');
                return false;
            }

            // Initialize PyOdide once (cached for subsequent calls)
            console.log('Initializing PyOdide for NumPy support...');
            await numpyFunctions.initializePyodide();
            console.log('✅ PyOdide initialized and cached for spreadsheet');

            // Register numpy functions in interpreter with NP_ prefix to avoid conflicts
            if (!this.interpreter.builtinFunctions) {
                this.interpreter.builtinFunctions = {};
            }

            // Install common numpy functions with NP_ prefix
            const numpyFuncs = {
                // Array creation
                'NP_ZEROS': numpyFunctions.zeros,
                'NP_ONES': numpyFunctions.ones,
                'NP_EYE': numpyFunctions.eye,
                'NP_ARANGE': numpyFunctions.arange,
                'NP_LINSPACE': numpyFunctions.linspace,

                // Math functions
                'NP_SIN': numpyFunctions.sin,
                'NP_COS': numpyFunctions.cos,
                'NP_EXP': numpyFunctions.exp,
                'NP_LOG': numpyFunctions.log,
                'NP_SQRT': numpyFunctions.sqrt,

                // Statistics
                'NP_MEAN': numpyFunctions.mean,
                'NP_MEDIAN': numpyFunctions.median,
                'NP_STD': numpyFunctions.std,
                'NP_SUM': numpyFunctions.sum,

                // Linear algebra
                'NP_DOT': numpyFunctions.dot,
                'NP_MATMUL': numpyFunctions.matmul,
                'NP_DET': numpyFunctions.det,
                'NP_INV': numpyFunctions.inv,
                'NP_EIGVALS': numpyFunctions.eigvals,
                'NP_EIG': numpyFunctions.eig,

                // Array manipulation
                'NP_RESHAPE': numpyFunctions.reshape,
                'NP_TRANSPOSE': numpyFunctions.transpose,
                'NP_FLATTEN': numpyFunctions.flatten
            };

            Object.entries(numpyFuncs).forEach(([name, func]) => {
                this.interpreter.builtinFunctions[name] = func;
            });

            console.log(`✅ ${Object.keys(numpyFuncs).length} NumPy functions registered with spreadsheet`);
            return true;
        } catch (error) {
            console.error('Failed to install NumPy functions:', error);
            return false;
        }
    }
}

// Export for Node.js (Jest), ES6 modules, and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpreadsheetRexxAdapter;
}

export default SpreadsheetRexxAdapter;
