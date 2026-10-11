/*!
 * Spreadsheet Functions Library for RexxJS
 * Provides Excel-like range functions for spreadsheet formulas
 * @rexxjs-meta=SPREADSHEET_FUNCTIONS_META
 */

// Get the spreadsheet adapter from global context (set by the app)
// sae: a page has no window; the page hands its adapter over with useAdapter.
let saeAdapter = null;
export function useAdapter(adapter) { saeAdapter = adapter; }

function getAdapter() {
    if (saeAdapter) return saeAdapter;
    if (typeof window !== 'undefined' && window.spreadsheetAdapter) {
        return window.spreadsheetAdapter;
    }
    throw new Error('Spreadsheet adapter not available');
}

/**
 * RangeQuery - Chainable query object for range operations
 * Supports method chaining for filtering, transforming, and aggregating ranges
 */
class RangeQuery {
    constructor(rangeRef, adapter, tableMetadata) {
        this.adapter = adapter || getAdapter();
        this.rangeRef = rangeRef;
        this.tableMetadata = tableMetadata || null; // Optional table metadata

        // Get initial data
        if (typeof rangeRef === 'string') {
            // Parse range reference (e.g., "A1:D100" or named range)
            const model = this.adapter.model;

            // Check if it's a named range
            if (model.namedRanges.has(rangeRef)) {
                this.rangeRef = model.namedRanges.get(rangeRef);
            }

            // Get the raw cell values as a 2D array
            this.data = this._getRangeData(this.rangeRef);
        } else if (Array.isArray(rangeRef)) {
            // Already processed data
            this.data = rangeRef;
        } else {
            throw new Error('Invalid range reference');
        }

        // Use table metadata for headers if available
        if (this.tableMetadata && this.tableMetadata.columns) {
            this.columnMap = this.tableMetadata.columns; // Map column names to letters

            // Build headers array in column order (A, B, C, etc.)
            const columnEntries = Object.entries(this.tableMetadata.columns);
            // Sort by column letter to ensure proper order
            columnEntries.sort((a, b) => {
                const colA = this.adapter.model.constructor.colLetterToNumber(a[1]);
                const colB = this.adapter.model.constructor.colLetterToNumber(b[1]);
                return colA - colB;
            });
            this.headers = columnEntries.map(([name, letter]) => name);

            // Skip header row if table has header
            if (this.tableMetadata.hasHeader && this.data.length > 0) {
                this.data = this.data.slice(1);
            }
        } else {
            // Fallback: auto-detect headers from first row
            this.headers = null;
            this.columnMap = null;
            if (this.data.length > 0) {
                const firstRow = this.data[0];
                const allStrings = firstRow.every(cell => typeof cell === 'string' && cell !== '');
                const hasNumbers = this.data.slice(1).some(row => row.some(cell => typeof cell === 'number'));

                if (allStrings && hasNumbers) {
                    this.headers = firstRow;
                    this.data = this.data.slice(1); // Remove header row from data
                }
            }
        }
    }

    _getRangeData(rangeRef) {
        const [start, end] = rangeRef.split(':');
        const model = this.adapter.model;
        const startParsed = model.constructor.parseCellRef(start);
        const endParsed = model.constructor.parseCellRef(end);

        const startCol = model.constructor.colLetterToNumber(startParsed.col);
        const endCol = model.constructor.colLetterToNumber(endParsed.col);
        const startRow = startParsed.row;
        const endRow = endParsed.row;

        const rows = [];
        for (let row = startRow; row <= endRow; row++) {
            const rowData = [];
            for (let col = startCol; col <= endCol; col++) {
                const ref = model.constructor.formatCellRef(col, row);
                const value = model.getCellValue(ref);
                const numValue = parseFloat(value);
                rowData.push(isNaN(numValue) ? value : numValue);
            }
            rows.push(rowData);
        }

        return rows;
    }

    _getColumnIndex(colRef) {
        if (typeof colRef === 'number') {
            return colRef;
        }

        // Check if it's a column name (header)
        if (this.headers) {
            const index = this.headers.indexOf(colRef);
            if (index !== -1) {
                return index;
            }
        }

        // Check if it's a column letter (A, B, C, etc.)
        if (typeof colRef === 'string' && /^[A-Z]+$/i.test(colRef)) {
            const model = this.adapter.model;
            const colNum = model.constructor.colLetterToNumber(colRef);
            const startParsed = model.constructor.parseCellRef(this.rangeRef.split(':')[0]);
            const startCol = model.constructor.colLetterToNumber(startParsed.col);
            return colNum - startCol;
        }

        throw new Error(`Unknown column reference: ${colRef}`);
    }

    // Helper method for internal use (backward compatibility)
    WHERE(condition) {
        return WHERE(this, condition);
    }

    _evaluateCondition(row, condition) {
        // Parse condition: "column_C > 1000" or "region='West'" or "column_A != ''"
        // Support: column_X, colX, X (where X is letter or name)

        // Replace column references with row values
        let expr = condition;

        // Match column_X or col_X patterns
        const colPatterns = [
            /column_([A-Z]+|\w+)/gi,
            /col_([A-Z]+|\w+)/gi
        ];

        for (const pattern of colPatterns) {
            expr = expr.replace(pattern, (match, colRef) => {
                const colIndex = this._getColumnIndex(colRef);
                const value = row[colIndex];
                return typeof value === 'string' ? `"${value}"` : value;
            });
        }

        // Match standalone column names (if we have headers)
        if (this.headers) {
            this.headers.forEach((header, index) => {
                const regex = new RegExp(`\\b${header}\\b`, 'g');
                expr = expr.replace(regex, () => {
                    const value = row[index];
                    return typeof value === 'string' ? `"${value}"` : value;
                });
            });
        }

        // Evaluate the expression
        try {
            return eval(expr);
        } catch (e) {
            throw new Error(`Invalid WHERE condition: ${condition} - ${e.message}`);
        }
    }

    // Helper method for internal use (backward compatibility)
    PLUCK(colRef) {
        return PLUCK(this, colRef);
    }

    // Helper method for internal use (backward compatibility)
    GROUP_BY(colRef) {
        return GROUP_BY(this, colRef);
    }

    // Helper method for internal use (backward compatibility)
    SUM(colRef) {
        return SUM(this, colRef);
    }

    // Helper method for internal use (backward compatibility)
    COUNT() {
        return COUNT(this);
    }

    // Helper method for internal use (backward compatibility)
    AVG(colRef) {
        return AVG(this, colRef);
    }

    // Helper method for internal use (backward compatibility)
    RESULT() {
        return RESULT(this);
    }
}

// ============================================================================
// Standalone Pipeline Functions (for use with |> operator)
// ============================================================================

/**
 * WHERE - Filter rows based on a condition
 * Usage: RANGE('A1:D100') |> WHERE('column_C > 1000')
 * @param {RangeQuery} query - Input range query
 * @param {string|function} condition - Condition expression or function
 * @returns {RangeQuery} Filtered range query
 */
function WHERE(query, condition) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('WHERE requires a RangeQuery as first argument');
    }

    let filteredData;

    if (typeof condition === 'function') {
        // Function filter
        filteredData = query.data.filter(condition);
    } else if (typeof condition === 'string') {
        // Parse condition string (e.g., "column_C > 1000", "region='West'")
        filteredData = query.data.filter(row => {
            return query._evaluateCondition(row, condition);
        });
    } else {
        throw new Error('WHERE condition must be a string or function');
    }

    // Return new RangeQuery with filtered data
    const newQuery = new RangeQuery(filteredData, query.adapter, query.tableMetadata);
    newQuery.headers = query.headers;
    newQuery.columnMap = query.columnMap;
    newQuery.rangeRef = query.rangeRef;
    return newQuery;
}

/**
 * PLUCK - Extract a single column
 * Usage: RANGE('A1:D100') |> PLUCK('B')
 * @param {RangeQuery} query - Input range query
 * @param {string|number} colRef - Column reference (letter, name, or index)
 * @returns {Array} Column values
 */
function PLUCK(query, colRef) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('PLUCK requires a RangeQuery as first argument');
    }

    const colIndex = query._getColumnIndex(colRef);
    const column = query.data.map(row => row[colIndex]);

    // Return array (not RangeQuery, since it's 1D)
    return column;
}

/**
 * GROUP_BY - Group rows by column value
 * Usage: RANGE('A1:D100') |> GROUP_BY('B')
 * @param {RangeQuery} query - Input range query
 * @param {string|number} colRef - Column to group by
 * @returns {RangeQuery} Grouped range query
 */
function GROUP_BY(query, colRef) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('GROUP_BY requires a RangeQuery as first argument');
    }

    const colIndex = query._getColumnIndex(colRef);

    const groups = {};
    query.data.forEach(row => {
        const key = row[colIndex];
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(row);
    });

    // Store groups for aggregation
    const newQuery = new RangeQuery([], query.adapter, query.tableMetadata);
    newQuery.headers = query.headers;
    newQuery.columnMap = query.columnMap;
    newQuery.rangeRef = query.rangeRef;
    newQuery.groups = groups;
    newQuery.groupByColumn = colIndex;

    return newQuery;
}

/**
 * SUM - Sum values in a column (works after GROUP_BY)
 * Usage: RANGE('A1:D100') |> GROUP_BY('B') |> SUM('D')
 * @param {RangeQuery} query - Input range query
 * @param {string|number} colRef - Column to sum
 * @returns {Object|number} Sum by group or total sum
 */
function SUM(query, colRef) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('SUM requires a RangeQuery as first argument');
    }

    const colIndex = query._getColumnIndex(colRef);

    if (query.groups) {
        // Aggregate by groups
        const result = {};
        Object.entries(query.groups).forEach(([key, rows]) => {
            result[key] = rows.reduce((sum, row) => {
                const val = parseFloat(row[colIndex]);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);
        });
        return result;
    } else {
        // Simple sum across all rows
        return query.data.reduce((sum, row) => {
            const val = parseFloat(row[colIndex]);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    }
}

/**
 * AVG - Average values in a column (works after GROUP_BY)
 * Usage: RANGE('A1:D100') |> GROUP_BY('B') |> AVG('D')
 * @param {RangeQuery} query - Input range query
 * @param {string|number} colRef - Column to average
 * @returns {Object|number} Average by group or total average
 */
function AVG(query, colRef) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('AVG requires a RangeQuery as first argument');
    }

    const colIndex = query._getColumnIndex(colRef);

    if (query.groups) {
        // Average by groups
        const result = {};
        Object.entries(query.groups).forEach(([key, rows]) => {
            const values = rows.map(row => parseFloat(row[colIndex])).filter(v => !isNaN(v));
            result[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        });
        return result;
    } else {
        // Simple average
        const values = query.data.map(row => parseFloat(row[colIndex])).filter(v => !isNaN(v));
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
}

/**
 * COUNT - Count rows (works after GROUP_BY)
 * Usage: RANGE('A1:D100') |> GROUP_BY('B') |> COUNT()
 * @param {RangeQuery} query - Input range query
 * @returns {Object|number} Count by group or total count
 */
function COUNT(query) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('COUNT requires a RangeQuery as first argument');
    }

    if (query.groups) {
        // Count by groups
        const result = {};
        Object.entries(query.groups).forEach(([key, rows]) => {
            result[key] = rows.length;
        });
        return result;
    } else {
        // Simple count
        return query.data.length;
    }
}

/**
 * RESULT - Return the data (final step in chain)
 * Usage: RANGE('A1:D100') |> WHERE('column_C > 1000') |> RESULT()
 * @param {RangeQuery} query - Input range query
 * @returns {Array|Object} Data array or groups object
 */
function RESULT(query) {
    if (!(query instanceof RangeQuery)) {
        throw new Error('RESULT requires a RangeQuery as first argument');
    }

    if (query.groups) {
        // Return groups as is
        return query.groups;
    }
    return query.data;
}

// ============================================================================
// Main Functions
// ============================================================================

// RANGE - Create a queryable range object for chaining operations
function RANGE(rangeRef) {
    const adapter = getAdapter();
    return new RangeQuery(rangeRef, adapter);
}

/**
 * TABLE - Create a queryable table with metadata
 * Uses table metadata for column names and types
 * @param {string} tableName - Name of the table (must have metadata defined)
 * @returns {RangeQuery} Queryable range with table metadata
 */
function TABLE(tableName) {
    const adapter = getAdapter();
    const model = adapter.model;

    // Get table metadata
    const metadata = model.getTableMetadata(tableName);
    if (!metadata) {
        throw new Error(`Table '${tableName}' not found. Use setTableMetadata() to define table metadata.`);
    }

    // Create RangeQuery with table metadata
    return new RangeQuery(metadata.range, adapter, metadata);
}

// SUM a range of cells
function SUM_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    return values.reduce((sum, val) => {
        const num = parseFloat(val);
        return sum + (isNaN(num) ? 0 : num);
    }, 0);
}

// AVERAGE a range of cells
function AVERAGE_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v)));
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((s, v) => s + parseFloat(v), 0);
    return sum / numbers.length;
}

// COUNT non-empty cells in range
function COUNT_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    return values.filter(v => v !== '' && v !== null && v !== undefined).length;
}

// MIN value in range
function MIN_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    return numbers.length > 0 ? Math.min(...numbers) : 0;
}

// MAX value in range
function MAX_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    return numbers.length > 0 ? Math.max(...numbers) : 0;
}

// Get cell value by reference
function CELL(ref) {
    const adapter = getAdapter();
    const value = adapter.model.getCellValue(ref);
    const numValue = parseFloat(value);
    return isNaN(numValue) ? value : numValue;
}

// MEDIAN value in range
function MEDIAN_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    if (numbers.length === 0) return 0;

    numbers.sort((a, b) => a - b);
    const mid = Math.floor(numbers.length / 2);

    if (numbers.length % 2 === 0) {
        return (numbers[mid - 1] + numbers[mid]) / 2;
    } else {
        return numbers[mid];
    }
}

// STDEV (standard deviation) of range - sample standard deviation
function STDEV_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    if (numbers.length < 2) return 0;

    const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
    const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((s, v) => s + v, 0) / (numbers.length - 1);

    return Math.sqrt(variance);
}

// STDEVP (standard deviation) of range - population standard deviation
function STDEVP_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    if (numbers.length === 0) return 0;

    const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
    const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((s, v) => s + v, 0) / numbers.length;

    return Math.sqrt(variance);
}

// PRODUCT of range
function PRODUCT_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    if (numbers.length === 0) return 0;

    return numbers.reduce((product, v) => product * v, 1);
}

// VAR (variance) of range - sample variance
function VAR_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    if (numbers.length < 2) return 0;

    const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
    const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));

    return squaredDiffs.reduce((s, v) => s + v, 0) / (numbers.length - 1);
}

// VARP (variance) of range - population variance
function VARP_RANGE(rangeRef) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);
    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
    if (numbers.length === 0) return 0;

    const mean = numbers.reduce((s, v) => s + v, 0) / numbers.length;
    const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));

    return squaredDiffs.reduce((s, v) => s + v, 0) / numbers.length;
}

// SUMIF - Sum cells in range that meet a condition
function SUMIF_RANGE(rangeRef, condition) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);

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
}

// COUNTIF - Count cells in range that meet a condition
function COUNTIF_RANGE(rangeRef, condition) {
    const adapter = getAdapter();
    const values = adapter.getCellRange(rangeRef);

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
}

// RexxJS library metadata function
function SPREADSHEET_FUNCTIONS_META() {
    return {
        name: 'spreadsheet-functions',
        version: '2.1.0',
        type: 'functions',
        description: 'Comprehensive spreadsheet range functions for RexxJS - Excel-like statistical and conditional functions with query chaining support',
        functions: [
            'RANGE',
            'SUM_RANGE',
            'AVERAGE_RANGE',
            'COUNT_RANGE',
            'MIN_RANGE',
            'MAX_RANGE',
            'MEDIAN_RANGE',
            'STDEV_RANGE',
            'STDEVP_RANGE',
            'PRODUCT_RANGE',
            'VAR_RANGE',
            'VARP_RANGE',
            'SUMIF_RANGE',
            'COUNTIF_RANGE',
            'CELL'
        ],
        classes: [
            'RangeQuery'
        ]
    };
}

// Export for Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RANGE,
        TABLE,
        RangeQuery,
        // Pipeline functions (for |> operator)
        WHERE,
        PLUCK,
        GROUP_BY,
        SUM,
        AVG,
        COUNT,
        RESULT,
        // Traditional range functions
        SUM_RANGE,
        AVERAGE_RANGE,
        COUNT_RANGE,
        MIN_RANGE,
        MAX_RANGE,
        MEDIAN_RANGE,
        STDEV_RANGE,
        STDEVP_RANGE,
        PRODUCT_RANGE,
        VAR_RANGE,
        VARP_RANGE,
        SUMIF_RANGE,
        COUNTIF_RANGE,
        CELL,
        SPREADSHEET_FUNCTIONS_META
    };
}

// Export for browser/window (required for RexxJS REQUIRE in web mode)
if (typeof window !== 'undefined') {
    window.RANGE = RANGE;
    window.TABLE = TABLE;
    window.RangeQuery = RangeQuery;
    // Pipeline functions (for |> operator)
    window.WHERE = WHERE;
    window.PLUCK = PLUCK;
    window.GROUP_BY = GROUP_BY;
    window.SUM = SUM;
    window.AVG = AVG;
    window.COUNT = COUNT;
    window.RESULT = RESULT;
    // Traditional range functions
    window.SUM_RANGE = SUM_RANGE;
    window.AVERAGE_RANGE = AVERAGE_RANGE;
    window.COUNT_RANGE = COUNT_RANGE;
    window.MIN_RANGE = MIN_RANGE;
    window.MAX_RANGE = MAX_RANGE;
    window.MEDIAN_RANGE = MEDIAN_RANGE;
    window.STDEV_RANGE = STDEV_RANGE;
    window.STDEVP_RANGE = STDEVP_RANGE;
    window.PRODUCT_RANGE = PRODUCT_RANGE;
    window.VAR_RANGE = VAR_RANGE;
    window.VARP_RANGE = VARP_RANGE;
    window.SUMIF_RANGE = SUMIF_RANGE;
    window.COUNTIF_RANGE = COUNTIF_RANGE;
    window.CELL = CELL;
    window.SPREADSHEET_FUNCTIONS_META = SPREADSHEET_FUNCTIONS_META;
}

// sae: the library as a module's exports, for interpreter.externalFunctions
// (where the app registers its control functions too).
export const SPREADSHEET_FUNCTIONS = {
    RANGE, TABLE, WHERE, PLUCK, GROUP_BY, SUM, AVG, COUNT, RESULT,
    SUM_RANGE, AVERAGE_RANGE, COUNT_RANGE, MIN_RANGE, MAX_RANGE, MEDIAN_RANGE,
    STDEV_RANGE, STDEVP_RANGE, PRODUCT_RANGE, VAR_RANGE, VARP_RANGE,
    SUMIF_RANGE, COUNTIF_RANGE, CELL,
};
