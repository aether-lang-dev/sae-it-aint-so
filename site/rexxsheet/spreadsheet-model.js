/**
 * SpreadsheetModel - Core spreadsheet logic (no DOM, pure JS)
 *
 * Responsibilities:
 * - Cell storage and retrieval
 * - A1-style addressing (A1, B2, AA10, etc.)
 * - Track cell values vs expressions
 * - Dependency tracking for recalculation
 * - Evaluation order resolution
 */

class SpreadsheetModel {
    constructor(rows = 100, cols = 26) {
        this.rows = rows;
        this.cols = cols;

        // Multi-sheet support
        this.sheets = new Map(); // key: sheet name, value: sheet data
        this.activeSheetName = 'Sheet1'; // Current active sheet
        this.sheetOrder = ['Sheet1']; // Ordered list of sheet names

        // Initialize default sheet
        this._initializeSheet('Sheet1');

        this.setupScript = ''; // Page-level RexxJS code (REQUIRE statements, etc.)
        this.undoStack = []; // History for undo
        this.redoStack = []; // History for redo
        this.maxHistorySize = 100; // Limit undo/redo stack size
        this.recordingHistory = true; // Flag to enable/disable history recording
    }

    /**
     * Initialize a new sheet with default values
     */
    _initializeSheet(name) {
        this.sheets.set(name, {
            cells: new Map(), // key: "A1", value: {value, expression, dependencies}
            dependents: new Map(), // key: "A1", value: Set of cells that depend on A1
            evaluationInProgress: new Set(), // For circular reference detection
            hiddenRows: new Set(), // Set of hidden row numbers
            hiddenColumns: new Set(), // Set of hidden column numbers
            columnWidths: new Map(), // key: column number, value: width in pixels
            rowHeights: new Map(), // key: row number, value: height in pixels
            namedRanges: new Map(), // key: "MyRange", value: "A1:B5"
            frozenRows: 0, // Number of rows frozen at top
            frozenColumns: 0, // Number of columns frozen at left
            validations: new Map(), // key: "A1", value: validation rules
            filteredRows: null, // null = no filter, Set = visible rows
            filterCriteria: null, // Filter criteria object
            columnOrder: null, // null = default order, Array = custom column order
            mergedCells: new Map(), // key: "A1" (top-left), value: "C3" (bottom-right)
            cellEditors: new Map(), // key: "A1", value: {type: 'checkbox'|'dropdown'|'date', config: {}}
            pivotTables: new Map(), // key: pivotId, value: {sourceRange, rowFields, colFields, valueField, aggFunction, outputCell}
            autoIdColumn: null, // Column for auto-IDs (e.g., "A" or null if disabled)
            nextId: 1, // Next ID to assign
            idPrefix: '', // Optional prefix for IDs (e.g., "ID-")
            tableMetadata: new Map() // key: tableName, value: {range, columns, hasHeader, types, descriptions}
        });
    }

    /**
     * Get the active sheet data
     */
    _getActiveSheet() {
        return this.sheets.get(this.activeSheetName);
    }

    /**
     * Get sheet data by name
     */
    _getSheet(sheetName) {
        return this.sheets.get(sheetName || this.activeSheetName);
    }

    /**
     * Legacy compatibility: expose cells, dependents, etc. from active sheet
     */
    get cells() {
        return this._getActiveSheet().cells;
    }
    set cells(value) {
        this._getActiveSheet().cells = value;
    }

    get dependents() {
        return this._getActiveSheet().dependents;
    }
    set dependents(value) {
        this._getActiveSheet().dependents = value;
    }

    get evaluationInProgress() {
        return this._getActiveSheet().evaluationInProgress;
    }
    set evaluationInProgress(value) {
        this._getActiveSheet().evaluationInProgress = value;
    }

    get hiddenRows() {
        return this._getActiveSheet().hiddenRows;
    }
    set hiddenRows(value) {
        this._getActiveSheet().hiddenRows = value;
    }

    get hiddenColumns() {
        return this._getActiveSheet().hiddenColumns;
    }
    set hiddenColumns(value) {
        this._getActiveSheet().hiddenColumns = value;
    }

    get namedRanges() {
        return this._getActiveSheet().namedRanges;
    }
    set namedRanges(value) {
        this._getActiveSheet().namedRanges = value;
    }

    get frozenRows() {
        return this._getActiveSheet().frozenRows;
    }
    set frozenRows(value) {
        this._getActiveSheet().frozenRows = value;
    }

    get frozenColumns() {
        return this._getActiveSheet().frozenColumns;
    }
    set frozenColumns(value) {
        this._getActiveSheet().frozenColumns = value;
    }

    get validations() {
        return this._getActiveSheet().validations;
    }
    set validations(value) {
        this._getActiveSheet().validations = value;
    }

    get filteredRows() {
        return this._getActiveSheet().filteredRows;
    }
    set filteredRows(value) {
        this._getActiveSheet().filteredRows = value;
    }

    get filterCriteria() {
        return this._getActiveSheet().filterCriteria;
    }
    set filterCriteria(value) {
        this._getActiveSheet().filterCriteria = value;
    }

    get columnOrder() {
        return this._getActiveSheet().columnOrder;
    }
    set columnOrder(value) {
        this._getActiveSheet().columnOrder = value;
    }

    get columnWidths() {
        return this._getActiveSheet().columnWidths;
    }
    set columnWidths(value) {
        this._getActiveSheet().columnWidths = value;
    }

    get rowHeights() {
        return this._getActiveSheet().rowHeights;
    }
    set rowHeights(value) {
        this._getActiveSheet().rowHeights = value;
    }

    get mergedCells() {
        return this._getActiveSheet().mergedCells;
    }
    set mergedCells(value) {
        this._getActiveSheet().mergedCells = value;
    }

    get cellEditors() {
        return this._getActiveSheet().cellEditors;
    }
    set cellEditors(value) {
        this._getActiveSheet().cellEditors = value;
    }

    get pivotTables() {
        return this._getActiveSheet().pivotTables;
    }
    set pivotTables(value) {
        this._getActiveSheet().pivotTables = value;
    }

    get tableMetadata() {
        return this._getActiveSheet().tableMetadata;
    }
    set tableMetadata(value) {
        this._getActiveSheet().tableMetadata = value;
    }

    get autoIdColumn() {
        return this._getActiveSheet().autoIdColumn;
    }
    set autoIdColumn(value) {
        this._getActiveSheet().autoIdColumn = value;
    }

    get nextId() {
        return this._getActiveSheet().nextId;
    }
    set nextId(value) {
        this._getActiveSheet().nextId = value;
    }

    get idPrefix() {
        return this._getActiveSheet().idPrefix;
    }
    set idPrefix(value) {
        this._getActiveSheet().idPrefix = value;
    }

    /**
     * Convert column letter(s) to number (A=1, B=2, ..., Z=26, AA=27, etc.)
     */
    static colLetterToNumber(col) {
        col = col.toUpperCase();
        let result = 0;
        for (let i = 0; i < col.length; i++) {
            result = result * 26 + (col.charCodeAt(i) - 64);
        }
        return result;
    }

    /**
     * Convert column number to letter(s) (1=A, 2=B, ..., 26=Z, 27=AA, etc.)
     */
    static colNumberToLetter(num) {
        let result = '';
        while (num > 0) {
            let remainder = (num - 1) % 26;
            result = String.fromCharCode(65 + remainder) + result;
            num = Math.floor((num - 1) / 26);
        }
        return result;
    }

    /**
     * Parse cell reference like "A1" into {col: "A", row: 1}
     * Also supports cross-sheet references like "Sheet2.A1"
     */
    static parseCellRef(ref) {
        // Check for cross-sheet reference
        const sheetMatch = ref.match(/^([A-Za-z][A-Za-z0-9_]*)\.([A-Z]+\d+)$/i);
        if (sheetMatch) {
            return {
                sheet: sheetMatch[1],
                col: sheetMatch[2].match(/^([A-Z]+)(\d+)$/i)[1].toUpperCase(),
                row: parseInt(sheetMatch[2].match(/^([A-Z]+)(\d+)$/i)[2], 10)
            };
        }

        // Regular cell reference
        const match = ref.match(/^([A-Z]+)(\d+)$/i);
        if (!match) {
            throw new Error(`Invalid cell reference: ${ref}`);
        }
        return {
            col: match[1].toUpperCase(),
            row: parseInt(match[2], 10)
        };
    }

    /**
     * Format cell reference from {col, row, sheet?}
     */
    static formatCellRef(col, row, sheet) {
        if (typeof col === 'number') {
            col = SpreadsheetModel.colNumberToLetter(col);
        }
        const cellRef = `${col}${row}`;
        return sheet ? `${sheet}.${cellRef}` : cellRef;
    }

    /**
     * Validate sheet name (must be valid Rexx variable name)
     * - Must start with a letter
     * - Can contain only letters, numbers, and underscores
     * - No spaces or special characters
     */
    static isValidSheetName(name) {
        return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
    }

    /**
     * Sheet Management Methods
     */

    /**
     * Add a new sheet
     */
    addSheet(name) {
        if (!SpreadsheetModel.isValidSheetName(name)) {
            throw new Error('Sheet name must be a valid Rexx variable name (start with letter, no spaces)');
        }
        if (this.sheets.has(name)) {
            throw new Error(`Sheet "${name}" already exists`);
        }
        this._initializeSheet(name);
        this.sheetOrder.push(name);
        return name;
    }

    /**
     * Delete a sheet
     */
    deleteSheet(name) {
        if (this.sheets.size <= 1) {
            throw new Error('Cannot delete the last sheet');
        }
        if (!this.sheets.has(name)) {
            throw new Error(`Sheet "${name}" does not exist`);
        }

        this.sheets.delete(name);
        const index = this.sheetOrder.indexOf(name);
        if (index > -1) {
            this.sheetOrder.splice(index, 1);
        }

        // If we deleted the active sheet, switch to another one
        if (this.activeSheetName === name) {
            this.activeSheetName = this.sheetOrder[0];
        }
    }

    /**
     * Rename a sheet
     */
    renameSheet(oldName, newName) {
        if (!SpreadsheetModel.isValidSheetName(newName)) {
            throw new Error('Sheet name must be a valid Rexx variable name (start with letter, no spaces)');
        }
        if (!this.sheets.has(oldName)) {
            throw new Error(`Sheet "${oldName}" does not exist`);
        }
        if (this.sheets.has(newName)) {
            throw new Error(`Sheet "${newName}" already exists`);
        }

        const sheetData = this.sheets.get(oldName);
        this.sheets.delete(oldName);
        this.sheets.set(newName, sheetData);

        const index = this.sheetOrder.indexOf(oldName);
        if (index > -1) {
            this.sheetOrder[index] = newName;
        }

        if (this.activeSheetName === oldName) {
            this.activeSheetName = newName;
        }

        // TODO: Update formulas that reference this sheet
    }

    /**
     * Set the active sheet
     */
    setActiveSheet(name) {
        if (!this.sheets.has(name)) {
            throw new Error(`Sheet "${name}" does not exist`);
        }
        this.activeSheetName = name;
    }

    /**
     * Get all sheet names in order
     */
    getSheetNames() {
        return [...this.sheetOrder];
    }

    /**
     * Get the active sheet name
     */
    getActiveSheetName() {
        return this.activeSheetName;
    }

    /**
     * Get cell data
     */
    getCell(ref) {
        if (typeof ref === 'object') {
            ref = SpreadsheetModel.formatCellRef(ref.col, ref.row);
        }
        return this.cells.get(ref) || { value: '', expression: null, dependencies: [], chartScript: null, wrapText: false };
    }

    /**
     * Get cell value (computed result)
     */
    getCellValue(ref) {
        return this.getCell(ref).value;
    }

    /**
     * Get cell expression (formula)
     */
    getCellExpression(ref) {
        return this.getCell(ref).expression;
    }

    /**
     * Set cell content
     * If content starts with '=', treat as expression
     * Otherwise, treat as literal value
     */
    setCell(ref, content, rexxInterpreter = null, metadata = {}) {
        if (typeof ref === 'object') {
            ref = SpreadsheetModel.formatCellRef(ref.col, ref.row);
        }

        // Clear old dependencies
        const oldCell = this.cells.get(ref);
        if (oldCell && oldCell.dependencies) {
            oldCell.dependencies.forEach(dep => {
                const depSet = this.dependents.get(dep);
                if (depSet) {
                    depSet.delete(ref);
                }
            });
        }

        if (content === '' || content === null || content === undefined) {
            // Clear cell
            this.cells.delete(ref);
            return this.propagateChanges(ref, rexxInterpreter);   // sae: awaitable
        }

        const isExpression = typeof content === 'string' && content.trim().startsWith('=');
        // sae: setCell returns a promise of the cell evaluated and then its
        // dependents: they were started together, so a dependent could read
        // the old value, and nothing could await the ripple.
        let evaluated = null;

        if (isExpression) {
            // Store expression, evaluate later
            let expression = content.trim().substring(1).trim();

            // Resolve named ranges in the expression
            expression = this.resolveNamedRanges(expression);

            this.cells.set(ref, {
                value: '',
                expression: expression,
                dependencies: [],
                error: null,
                comment: metadata.comment || oldCell?.comment || '',
                format: metadata.format || oldCell?.format || '',
                chartScript: metadata.chartScript || oldCell?.chartScript || null,
                wrapText: metadata.wrapText !== undefined ? metadata.wrapText : (oldCell?.wrapText || false)
            });

            // Evaluate the expression
            if (rexxInterpreter) {
                evaluated = this.evaluateCell(ref, rexxInterpreter);
            }
        } else {
            // Literal value
            this.cells.set(ref, {
                value: content,
                expression: null,
                dependencies: [],
                error: null,
                comment: metadata.comment || oldCell?.comment || '',
                format: metadata.format || oldCell?.format || '',
                chartScript: metadata.chartScript || oldCell?.chartScript || null,
                wrapText: metadata.wrapText !== undefined ? metadata.wrapText : (oldCell?.wrapText || false)
            });
        }

        // Propagate to dependent cells
        return Promise.resolve(evaluated).then(() => this.propagateChanges(ref, rexxInterpreter));
    }

    /**
     * Evaluate a cell's expression using RexxJS
     */
    async evaluateCell(ref, rexxInterpreter) {
        const cell = this.cells.get(ref);
        if (!cell || !cell.expression) {
            return;
        }

        // Check for circular references
        if (this.evaluationInProgress.has(ref)) {
            cell.error = 'Circular reference';
            cell.value = '#CIRCULAR!';
            return;
        }

        this.evaluationInProgress.add(ref);

        try {
            // Extract cell references from expression
            const dependencies = this.extractCellReferences(cell.expression);
            cell.dependencies = dependencies;

            // Update dependents map
            dependencies.forEach(dep => {
                if (!this.dependents.has(dep)) {
                    this.dependents.set(dep, new Set());
                }
                this.dependents.get(dep).add(ref);
            });

            // Evaluate expression via RexxJS
            const result = await rexxInterpreter.evaluate(cell.expression, this);
            cell.value = result;
            cell.error = null;
        } catch (error) {
            cell.error = error.message;
            cell.value = '#ERROR!';
        } finally {
            this.evaluationInProgress.delete(ref);
        }
    }

    /**
     * Extract cell references from an expression
     * Matches patterns like A1, B2, AA10, and cross-sheet references like Sheet2.A1
     */
    extractCellReferences(expression) {
        const crossSheetPattern = /\b([A-Za-z][A-Za-z0-9_]*)\.([A-Z]+\d+)\b/gi;
        const cellRefPattern = /\b([A-Z]+\d+)\b/g;

        const refs = new Set();

        // Extract cross-sheet references first
        let match;
        while ((match = crossSheetPattern.exec(expression)) !== null) {
            refs.add(match[0]); // Full match: Sheet2.A1
        }

        // Extract local cell references
        const cellMatches = expression.match(cellRefPattern);
        if (cellMatches) {
            cellMatches.forEach(ref => {
                // Only add if not already part of a cross-sheet reference
                if (!Array.from(refs).some(r => r.endsWith('.' + ref))) {
                    refs.add(ref);
                }
            });
        }

        return Array.from(refs);
    }

    /**
     * Propagate changes to dependent cells
     */
    async propagateChanges(ref, rexxInterpreter, path = [ref]) {
        const deps = this.dependents.get(ref);
        if (!deps || !rexxInterpreter) {
            return;
        }

        for (const depRef of deps) {
            // sae: a dependent already on this path is a cycle. Each cell on
            // it is #CIRCULAR!, with the route; without this, propagation
            // went round the cycle until the stack ran out.
            const at = path.indexOf(depRef);
            if (at >= 0) {
                const route = [...path.slice(at), depRef].join(' → ');
                for (const r of path.slice(at)) {
                    const c = this.cells.get(r);
                    if (c) {
                        c.value = '#CIRCULAR!';
                        c.error = `Circular reference: ${route}`;
                    }
                }
                continue;
            }
            await this.evaluateCell(depRef, rexxInterpreter);
            await this.propagateChanges(depRef, rexxInterpreter, [...path, depRef]);
        }
    }

    /**
     * Get all non-empty cells
     */
    getAllCells() {
        const result = [];
        for (const [ref, cell] of this.cells.entries()) {
            result.push({ ref, ...cell });
        }
        return result;
    }

    /**
     * Set cell metadata (comment, format, chartScript)
     */
    setCellMetadata(ref, metadata) {
        if (typeof ref === 'object') {
            ref = SpreadsheetModel.formatCellRef(ref.col, ref.row);
        }

        const cell = this.cells.get(ref);
        if (!cell) {
            // Create empty cell with metadata
            this.cells.set(ref, {
                value: '',
                expression: null,
                dependencies: [],
                error: null,
                comment: metadata.comment || '',
                format: metadata.format || '',
                chartScript: metadata.chartScript || null,
                wrapText: metadata.wrapText || false
            });
        } else {
            // Update existing cell
            if (metadata.comment !== undefined) {
                cell.comment = metadata.comment;
            }
            if (metadata.format !== undefined) {
                cell.format = metadata.format;
            }
            if (metadata.chartScript !== undefined) {
                cell.chartScript = metadata.chartScript;
            }
            if (metadata.wrapText !== undefined) {
                cell.wrapText = metadata.wrapText;
            }
        }
    }

    /**
     * Parse a range reference (e.g., "A1:C3")
     * @param {string} rangeRef - Range reference
     * @returns {object|null} - {startCol, startRow, endCol, endRow} or null if invalid
     */
    parseRange(rangeRef) {
        const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) {
            return null;
        }

        const startColLetter = match[1].toUpperCase();
        const startRow = parseInt(match[2], 10);
        const endColLetter = match[3].toUpperCase();
        const endRow = parseInt(match[4], 10);

        return {
            startCol: SpreadsheetModel.colLetterToNumber(startColLetter),
            startRow,
            endCol: SpreadsheetModel.colLetterToNumber(endColLetter),
            endRow
        };
    }

    /**
     * Merge cells in a range
     * @param {string} rangeRef - Range reference (e.g., "A1:C3")
     * @param {object} rexxInterpreter - Optional Rexx interpreter for recalculation
     */
    mergeCells(rangeRef, rexxInterpreter = null) {
        const range = this.parseRange(rangeRef);
        if (!range) {
            throw new Error(`Invalid range: ${rangeRef}`);
        }

        const topLeft = SpreadsheetModel.formatCellRef(range.startCol, range.startRow);
        const bottomRight = SpreadsheetModel.formatCellRef(range.endCol, range.endRow);

        // Check if any cells in this range are already part of another merge
        for (let row = range.startRow; row <= range.endRow; row++) {
            for (let col = range.startCol; col <= range.endCol; col++) {
                const cellRef = SpreadsheetModel.formatCellRef(col, row);
                if (this.isCellMerged(cellRef) && cellRef !== topLeft) {
                    throw new Error(`Cell ${cellRef} is already part of a merged range`);
                }
            }
        }

        // Store the merge - top-left cell maps to bottom-right
        this.mergedCells.set(topLeft, bottomRight);

        // Save history
        this._recordSnapshot('mergeCells');

        return topLeft;
    }

    /**
     * Unmerge cells
     * @param {string} cellRef - Any cell reference in the merged range
     */
    unmergeCells(cellRef) {
        if (typeof cellRef === 'object') {
            cellRef = SpreadsheetModel.formatCellRef(cellRef.col, cellRef.row);
        }

        // Find the merge that contains this cell
        const mergeInfo = this.getMergedRange(cellRef);
        if (!mergeInfo) {
            throw new Error(`Cell ${cellRef} is not part of a merged range`);
        }

        // Remove the merge
        this.mergedCells.delete(mergeInfo.topLeft);

        // Save history
        this._recordSnapshot('unmergeCells');

        return mergeInfo.topLeft;
    }

    /**
     * Get merged range information for a cell
     * @param {string} cellRef - Cell reference
     * @returns {object|null} - {topLeft, bottomRight, range} or null if not merged
     */
    getMergedRange(cellRef) {
        if (typeof cellRef === 'object') {
            cellRef = SpreadsheetModel.formatCellRef(cellRef.col, cellRef.row);
        }

        // Check if this cell is the top-left of a merge
        const bottomRight = this.mergedCells.get(cellRef);
        if (bottomRight) {
            return {
                topLeft: cellRef,
                bottomRight: bottomRight,
                range: `${cellRef}:${bottomRight}`
            };
        }

        // Check if this cell is inside any merge
        const parsed = SpreadsheetModel.parseCellRef(cellRef);
        for (const [topLeft, bottomRight] of this.mergedCells.entries()) {
            const topLeftParsed = SpreadsheetModel.parseCellRef(topLeft);
            const bottomRightParsed = SpreadsheetModel.parseCellRef(bottomRight);

            if (parsed.row >= topLeftParsed.row && parsed.row <= bottomRightParsed.row &&
                SpreadsheetModel.colLetterToNumber(parsed.col) >= SpreadsheetModel.colLetterToNumber(topLeftParsed.col) &&
                SpreadsheetModel.colLetterToNumber(parsed.col) <= SpreadsheetModel.colLetterToNumber(bottomRightParsed.col)) {
                return {
                    topLeft: topLeft,
                    bottomRight: bottomRight,
                    range: `${topLeft}:${bottomRight}`
                };
            }
        }

        return null;
    }

    /**
     * Check if a cell is part of a merged range
     * @param {string} cellRef - Cell reference
     * @returns {boolean}
     */
    isCellMerged(cellRef) {
        return this.getMergedRange(cellRef) !== null;
    }

    /**
     * Set custom editor for a cell
     * @param {string} cellRef - Cell reference
     * @param {string} type - Editor type: 'checkbox', 'dropdown', 'date'
     * @param {object} config - Configuration object for the editor
     */
    setCellEditor(cellRef, type, config = {}) {
        if (typeof cellRef === 'object') {
            cellRef = SpreadsheetModel.formatCellRef(cellRef.col, cellRef.row);
        }

        const validTypes = ['checkbox', 'dropdown', 'date'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid editor type: ${type}. Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate config based on type
        if (type === 'dropdown' && !config.options) {
            throw new Error('Dropdown editor requires "options" array in config');
        }

        this.cellEditors.set(cellRef, { type, config });

        // Save history
        this._recordSnapshot('setCellEditor');

        return cellRef;
    }

    /**
     * Get custom editor for a cell
     * @param {string} cellRef - Cell reference
     * @returns {object|null} - {type, config} or null if no custom editor
     */
    getCellEditor(cellRef) {
        if (typeof cellRef === 'object') {
            cellRef = SpreadsheetModel.formatCellRef(cellRef.col, cellRef.row);
        }

        return this.cellEditors.get(cellRef) || null;
    }

    /**
     * Remove custom editor from a cell
     * @param {string} cellRef - Cell reference
     */
    removeCellEditor(cellRef) {
        if (typeof cellRef === 'object') {
            cellRef = SpreadsheetModel.formatCellRef(cellRef.col, cellRef.row);
        }

        this.cellEditors.delete(cellRef);

        // Save history
        this._recordSnapshot('removeCellEditor');

        return cellRef;
    }

    /**
     * Create or update a pivot table
     * @param {string} pivotId - Unique identifier for this pivot table
     * @param {object} config - Pivot configuration
     *   {sourceRange, rowFields, colFields, valueField, aggFunction, outputCell}
     * @param {object} rexxInterpreter - Optional interpreter for recalculation
     */
    createPivotTable(pivotId, config, rexxInterpreter = null) {
        // Validate configuration
        if (!config.sourceRange || !config.outputCell) {
            throw new Error('Pivot table requires sourceRange and outputCell');
        }
        if (!config.valueField || !config.aggFunction) {
            throw new Error('Pivot table requires valueField and aggFunction (SUM, COUNT, AVERAGE, MIN, MAX)');
        }

        const validAggFunctions = ['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX'];
        if (!validAggFunctions.includes(config.aggFunction.toUpperCase())) {
            throw new Error(`Invalid aggregation function: ${config.aggFunction}. Must be one of: ${validAggFunctions.join(', ')}`);
        }

        // Store pivot configuration
        this.pivotTables.set(pivotId, {
            sourceRange: config.sourceRange,
            rowFields: config.rowFields || [],
            colFields: config.colFields || [],
            valueField: config.valueField,
            aggFunction: config.aggFunction.toUpperCase(),
            outputCell: config.outputCell,
            filters: config.filters || {}
        });

        // Generate and populate pivot table
        this._generatePivotTable(pivotId, rexxInterpreter);

        // Save history
        this._recordSnapshot('createPivotTable');

        return pivotId;
    }

    /**
     * Update an existing pivot table
     * @param {string} pivotId - Pivot table identifier
     * @param {object} rexxInterpreter - Optional interpreter for recalculation
     */
    updatePivotTable(pivotId, rexxInterpreter = null) {
        if (!this.pivotTables.has(pivotId)) {
            throw new Error(`Pivot table not found: ${pivotId}`);
        }

        this._generatePivotTable(pivotId, rexxInterpreter);

        // Save history
        this._recordSnapshot('updatePivotTable');

        return pivotId;
    }

    /**
     * Delete a pivot table
     * @param {string} pivotId - Pivot table identifier
     */
    deletePivotTable(pivotId) {
        if (!this.pivotTables.has(pivotId)) {
            throw new Error(`Pivot table not found: ${pivotId}`);
        }

        this.pivotTables.delete(pivotId);

        // Save history
        this._recordSnapshot('deletePivotTable');

        return pivotId;
    }

    /**
     * Get pivot table configuration
     * @param {string} pivotId - Pivot table identifier
     * @returns {object|null} Pivot configuration or null
     */
    getPivotTable(pivotId) {
        return this.pivotTables.get(pivotId) || null;
    }

    /**
     * Get all pivot tables
     * @returns {Array} Array of {id, config} objects
     */
    getAllPivotTables() {
        const result = [];
        for (const [id, config] of this.pivotTables.entries()) {
            result.push({ id, config });
        }
        return result;
    }

    /**
     * Generate pivot table data and populate cells
     * @private
     */
    _generatePivotTable(pivotId, rexxInterpreter = null) {
        const config = this.pivotTables.get(pivotId);
        if (!config) return;

        // Parse source range
        const sourceRange = this.parseRange(config.sourceRange);
        if (!sourceRange) {
            throw new Error(`Invalid source range: ${config.sourceRange}`);
        }

        // Extract source data
        const sourceData = this._extractRangeData(sourceRange);

        // Build pivot table structure
        const pivotData = this._buildPivotData(sourceData, config);

        // Write pivot table to output cells
        this._writePivotTable(pivotData, config.outputCell, rexxInterpreter);
    }

    /**
     * Extract data from a range into array of row objects
     * @private
     */
    _extractRangeData(range) {
        const data = [];
        const headers = [];

        // Extract headers from first row
        for (let col = range.startCol; col <= range.endCol; col++) {
            const ref = SpreadsheetModel.formatCellRef(col, range.startRow);
            const cell = this.getCell(ref);
            headers.push(cell.value || `Column${col}`);
        }

        // Extract data rows
        for (let row = range.startRow + 1; row <= range.endRow; row++) {
            const rowData = {};
            for (let col = range.startCol; col <= range.endCol; col++) {
                const ref = SpreadsheetModel.formatCellRef(col, row);
                const cell = this.getCell(ref);
                const colIndex = col - range.startCol;
                rowData[headers[colIndex]] = cell.value || '';
            }
            data.push(rowData);
        }

        return { headers, data };
    }

    /**
     * Build pivot table from source data
     * @private
     */
    _buildPivotData(sourceData, config) {
        const { data } = sourceData;
        const rowFields = config.rowFields || [];
        const colFields = config.colFields || [];
        const valueField = config.valueField;
        const aggFunction = config.aggFunction;

        // Group data
        const groups = new Map();

        for (const row of data) {
            // Apply filters if any
            let includeRow = true;
            for (const [field, filterValue] of Object.entries(config.filters || {})) {
                if (row[field] !== filterValue) {
                    includeRow = false;
                    break;
                }
            }
            if (!includeRow) continue;

            // Build group key
            const rowKey = rowFields.map(f => row[f] || '').join('|');
            const colKey = colFields.map(f => row[f] || '').join('|');
            const key = `${rowKey}::${colKey}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    rowKey,
                    colKey,
                    rowValues: rowFields.map(f => row[f] || ''),
                    colValues: colFields.map(f => row[f] || ''),
                    values: []
                });
            }

            const value = parseFloat(row[valueField]);
            if (!isNaN(value)) {
                groups.get(key).values.push(value);
            }
        }

        // Calculate aggregations
        const result = new Map();
        for (const [key, group] of groups.entries()) {
            let aggregatedValue = 0;
            if (group.values.length > 0) {
                switch (aggFunction) {
                    case 'SUM':
                        aggregatedValue = group.values.reduce((a, b) => a + b, 0);
                        break;
                    case 'COUNT':
                        aggregatedValue = group.values.length;
                        break;
                    case 'AVERAGE':
                        aggregatedValue = group.values.reduce((a, b) => a + b, 0) / group.values.length;
                        break;
                    case 'MIN':
                        aggregatedValue = Math.min(...group.values);
                        break;
                    case 'MAX':
                        aggregatedValue = Math.max(...group.values);
                        break;
                }
            }
            result.set(key, {
                rowKey: group.rowKey,
                colKey: group.colKey,
                rowValues: group.rowValues,
                colValues: group.colValues,
                value: aggregatedValue
            });
        }

        // Get unique row and column values
        const uniqueRows = new Set();
        const uniqueCols = new Set();
        for (const entry of result.values()) {
            uniqueRows.add(entry.rowKey);
            uniqueCols.add(entry.colKey);
        }

        return {
            data: result,
            rowKeys: Array.from(uniqueRows),
            colKeys: Array.from(uniqueCols),
            rowFields,
            colFields
        };
    }

    /**
     * Write pivot table to spreadsheet cells
     * @private
     */
    _writePivotTable(pivotData, outputCell, rexxInterpreter = null) {
        const outputRef = SpreadsheetModel.parseCellRef(outputCell);
        let currentRow = outputRef.row;

        // Write column headers
        let currentCol = SpreadsheetModel.colLetterToNumber(outputRef.col);
        // Skip row label columns
        for (let i = 0; i < pivotData.rowFields.length; i++) {
            const ref = SpreadsheetModel.formatCellRef(currentCol + i, currentRow);
            this.setCell(ref, pivotData.rowFields[i] || '', rexxInterpreter);
        }
        currentCol += pivotData.rowFields.length;

        // Write column values as headers
        for (const colKey of pivotData.colKeys) {
            const ref = SpreadsheetModel.formatCellRef(currentCol, currentRow);
            this.setCell(ref, colKey || '(blank)', rexxInterpreter);
            currentCol++;
        }
        currentRow++;

        // Write data rows
        for (const rowKey of pivotData.rowKeys) {
            currentCol = SpreadsheetModel.colLetterToNumber(outputRef.col);

            // Write row labels
            const rowValues = Array.from(pivotData.data.values()).find(e => e.rowKey === rowKey)?.rowValues || [];
            for (let i = 0; i < pivotData.rowFields.length; i++) {
                const ref = SpreadsheetModel.formatCellRef(currentCol + i, currentRow);
                this.setCell(ref, rowValues[i] || '', rexxInterpreter);
            }
            currentCol += pivotData.rowFields.length;

            // Write values
            for (const colKey of pivotData.colKeys) {
                const key = `${rowKey}::${colKey}`;
                const entry = pivotData.data.get(key);
                const ref = SpreadsheetModel.formatCellRef(currentCol, currentRow);
                this.setCell(ref, entry ? String(entry.value) : '0', rexxInterpreter);
                currentCol++;
            }
            currentRow++;
        }
    }

    /**
     * Get setup script
     */
    getSetupScript() {
        return this.setupScript;
    }

    /**
     * Set setup script
     */
    setSetupScript(script) {
        this.setupScript = script || '';
    }

    /**
     * Export to JSON
     */
    toJSON() {
        const data = {
            version: 2, // Version 2 with multi-sheet support
            setupScript: this.setupScript,
            activeSheetName: this.activeSheetName,
            sheetOrder: [...this.sheetOrder],
            sheets: {}
        };

        // Export each sheet
        for (const [sheetName, sheet] of this.sheets.entries()) {
            const sheetData = {
                cells: {},
                hiddenRows: Array.from(sheet.hiddenRows),
                hiddenColumns: Array.from(sheet.hiddenColumns),
                columnWidths: Object.fromEntries(sheet.columnWidths),
                rowHeights: Object.fromEntries(sheet.rowHeights),
                namedRanges: Object.fromEntries(sheet.namedRanges),
                frozenRows: sheet.frozenRows,
                frozenColumns: sheet.frozenColumns,
                validations: Object.fromEntries(sheet.validations),
                mergedCells: Object.fromEntries(sheet.mergedCells),
                cellEditors: Object.fromEntries(sheet.cellEditors),
                pivotTables: Object.fromEntries(sheet.pivotTables),
                tableMetadata: Object.fromEntries(sheet.tableMetadata),
                autoIdColumn: sheet.autoIdColumn,
                nextId: sheet.nextId,
                idPrefix: sheet.idPrefix
            };

            // Add filter criteria if present
            if (sheet.filterCriteria) {
                sheetData.filterCriteria = sheet.filterCriteria;
            }

            // Export cells
            for (const [ref, cell] of sheet.cells.entries()) {
                const cellData = {};

                if (cell.expression) {
                    cellData.content = '=' + cell.expression;
                } else if (cell.value !== '') {
                    cellData.content = cell.value;
                }

                // Add metadata if present
                if (cell.comment) {
                    cellData.comment = cell.comment;
                }
                if (cell.format) {
                    cellData.format = cell.format;
                }
                if (cell.chartScript) {
                    cellData.chartScript = cell.chartScript;
                }
                if (cell.wrapText) {
                    cellData.wrapText = cell.wrapText;
                }

                // Only store if there's content or metadata
                if (cellData.content || cellData.comment || cellData.format || cellData.chartScript || cellData.wrapText) {
                    // If only content, store as string for backward compatibility
                    if (Object.keys(cellData).length === 1 && cellData.content) {
                        sheetData.cells[ref] = cellData.content;
                    } else {
                        sheetData.cells[ref] = cellData;
                    }
                }
            }

            data.sheets[sheetName] = sheetData;
        }

        return data;
    }

    /**
     * Import from JSON
     */
    fromJSON(data, rexxInterpreter = null) {
        this.undoStack = [];
        this.redoStack = [];

        // Handle version 2 (multi-sheet) format
        if (data.version === 2 && data.sheets) {
            this.setupScript = data.setupScript || '';
            this.sheets.clear();
            this.sheetOrder = data.sheetOrder || Object.keys(data.sheets);
            this.activeSheetName = data.activeSheetName || this.sheetOrder[0] || 'Sheet1';

            // Import each sheet
            for (const [sheetName, sheetData] of Object.entries(data.sheets)) {
                this._initializeSheet(sheetName);
                const sheet = this.sheets.get(sheetName);

                // Restore hidden rows/columns
                if (sheetData.hiddenRows) {
                    sheetData.hiddenRows.forEach(row => sheet.hiddenRows.add(row));
                }
                if (sheetData.hiddenColumns) {
                    sheetData.hiddenColumns.forEach(col => sheet.hiddenColumns.add(col));
                }

                // Restore column widths and row heights
                if (sheetData.columnWidths) {
                    Object.entries(sheetData.columnWidths).forEach(([col, width]) => {
                        sheet.columnWidths.set(Number(col), width);
                    });
                }
                if (sheetData.rowHeights) {
                    Object.entries(sheetData.rowHeights).forEach(([row, height]) => {
                        sheet.rowHeights.set(Number(row), height);
                    });
                }

                // Restore named ranges
                if (sheetData.namedRanges) {
                    Object.entries(sheetData.namedRanges).forEach(([name, range]) => {
                        sheet.namedRanges.set(name, range);
                    });
                }

                // Restore frozen panes
                sheet.frozenRows = sheetData.frozenRows || 0;
                sheet.frozenColumns = sheetData.frozenColumns || 0;

                // Restore validations
                if (sheetData.validations) {
                    Object.entries(sheetData.validations).forEach(([ref, validation]) => {
                        sheet.validations.set(ref, validation);
                    });
                }

                // Restore merged cells
                if (sheetData.mergedCells) {
                    Object.entries(sheetData.mergedCells).forEach(([topLeft, bottomRight]) => {
                        sheet.mergedCells.set(topLeft, bottomRight);
                    });
                }

                // Restore cell editors
                if (sheetData.cellEditors) {
                    Object.entries(sheetData.cellEditors).forEach(([ref, editor]) => {
                        sheet.cellEditors.set(ref, editor);
                    });
                }

                // Restore pivot tables
                if (sheetData.pivotTables) {
                    Object.entries(sheetData.pivotTables).forEach(([id, config]) => {
                        sheet.pivotTables.set(id, config);
                    });
                }

                // Restore table metadata
                if (sheetData.tableMetadata) {
                    Object.entries(sheetData.tableMetadata).forEach(([name, metadata]) => {
                        sheet.tableMetadata.set(name, metadata);
                    });
                }

                // Restore auto-ID configuration
                if (sheetData.autoIdColumn !== undefined) {
                    sheet.autoIdColumn = sheetData.autoIdColumn;
                }
                if (sheetData.nextId !== undefined) {
                    sheet.nextId = sheetData.nextId;
                }
                if (sheetData.idPrefix !== undefined) {
                    sheet.idPrefix = sheetData.idPrefix;
                }

                // Import cells first (filter needs cells to be present)
                const cells = sheetData.cells || {};
                const savedActive = this.activeSheetName;
                this.activeSheetName = sheetName;

                for (const [ref, cellData] of Object.entries(cells)) {
                    // Handle both string format and object format
                    if (typeof cellData === 'string') {
                        this.setCell(ref, cellData, rexxInterpreter);
                    } else {
                        const metadata = {
                            comment: cellData.comment || '',
                            format: cellData.format || '',
                            chartScript: cellData.chartScript || null,
                            wrapText: cellData.wrapText || false
                        };
                        this.setCell(ref, cellData.content || '', rexxInterpreter, metadata);
                    }
                }

                // Restore filter criteria after cells are imported
                if (sheetData.filterCriteria) {
                    this.applyRowFilter(sheetData.filterCriteria.column, sheetData.filterCriteria.criteria);
                }

                this.activeSheetName = savedActive;
            }
        }
        // Handle version 1 (single sheet) format - backward compatibility
        else if (data.setupScript !== undefined) {
            this.setupScript = data.setupScript || '';
            this.sheets.clear();
            this.sheetOrder = ['Sheet1'];
            this.activeSheetName = 'Sheet1';
            this._initializeSheet('Sheet1');

            // Restore hidden rows/columns
            if (data.hiddenRows) {
                data.hiddenRows.forEach(row => this.hiddenRows.add(row));
            }
            if (data.hiddenColumns) {
                data.hiddenColumns.forEach(col => this.hiddenColumns.add(col));
            }

            // Restore column widths and row heights
            if (data.columnWidths) {
                Object.entries(data.columnWidths).forEach(([col, width]) => {
                    this.columnWidths.set(Number(col), width);
                });
            }
            if (data.rowHeights) {
                Object.entries(data.rowHeights).forEach(([row, height]) => {
                    this.rowHeights.set(Number(row), height);
                });
            }

            // Restore named ranges
            if (data.namedRanges) {
                Object.entries(data.namedRanges).forEach(([name, range]) => {
                    this.namedRanges.set(name, range);
                });
            }

            // Restore frozen panes
            this.frozenRows = data.frozenRows || 0;
            this.frozenColumns = data.frozenColumns || 0;

            // Restore validations
            if (data.validations) {
                Object.entries(data.validations).forEach(([ref, validation]) => {
                    this.validations.set(ref, validation);
                });
            }

            // Restore merged cells
            if (data.mergedCells) {
                Object.entries(data.mergedCells).forEach(([topLeft, bottomRight]) => {
                    this.mergedCells.set(topLeft, bottomRight);
                });
            }

            // Restore cell editors
            if (data.cellEditors) {
                Object.entries(data.cellEditors).forEach(([ref, editor]) => {
                    this.cellEditors.set(ref, editor);
                });
            }

            // Restore pivot tables
            if (data.pivotTables) {
                Object.entries(data.pivotTables).forEach(([id, config]) => {
                    this.pivotTables.set(id, config);
                });
            }

            const cells = data.cells || {};
            for (const [ref, cellData] of Object.entries(cells)) {
                // Handle both string format and object format
                if (typeof cellData === 'string') {
                    this.setCell(ref, cellData, rexxInterpreter);
                } else {
                    const metadata = {
                        comment: cellData.comment || '',
                        format: cellData.format || '',
                        chartScript: cellData.chartScript || null,
                        wrapText: cellData.wrapText || false
                    };
                    this.setCell(ref, cellData.content || '', rexxInterpreter, metadata);
                }
            }
        } else {
            // Very old format - all entries are cells
            this.setupScript = '';
            this.sheets.clear();
            this.sheetOrder = ['Sheet1'];
            this.activeSheetName = 'Sheet1';
            this._initializeSheet('Sheet1');

            for (const [ref, content] of Object.entries(data)) {
                this.setCell(ref, content, rexxInterpreter);
            }
        }
    }

    /**
     * Insert a row at the specified position
     * Shifts all rows at or below the position down by 1
     */
    insertRow(rowNum, rexxInterpreter = null) {
        if (rowNum < 1 || rowNum > this.rows) {
            throw new Error(`Invalid row number: ${rowNum}. Must be between 1 and ${this.rows}`);
        }

        // Create a new map to hold updated cells
        const newCells = new Map();

        // Move cells down, starting from the bottom to avoid overwrites
        for (const [ref, cell] of this.cells.entries()) {
            const { col, row } = SpreadsheetModel.parseCellRef(ref);
            const cellCopy = { ...cell };

            // Adjust formula references if this cell has an expression
            if (cellCopy.expression) {
                cellCopy.expression = this._adjustCellReferencesInExpression(
                    cellCopy.expression,
                    'insertRow',
                    rowNum
                );
            }

            if (row >= rowNum) {
                // Shift this cell down
                const newRef = SpreadsheetModel.formatCellRef(col, row + 1);
                newCells.set(newRef, cellCopy);
            } else {
                // Keep this cell where it is
                newCells.set(ref, cellCopy);
            }
        }

        // Replace cells map
        this.cells = newCells;

        // Auto-generate ID if auto-ID column is configured
        if (this.autoIdColumn) {
            const idValue = this.idPrefix + this.nextId;
            const idCellRef = `${this.autoIdColumn}${rowNum}`;
            this.setCell(idCellRef, String(idValue), rexxInterpreter);
            this.nextId++; // Increment for next row
        }

        // Rebuild dependents map
        this._rebuildDependents();

        // Recalculate all formulas if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Delete a row at the specified position
     * Shifts all rows below the position up by 1
     */
    deleteRow(rowNum, rexxInterpreter = null) {
        if (rowNum < 1 || rowNum > this.rows) {
            throw new Error(`Invalid row number: ${rowNum}. Must be between 1 and ${this.rows}`);
        }

        // Create a new map to hold updated cells
        const newCells = new Map();

        // Delete row and shift cells up
        for (const [ref, cell] of this.cells.entries()) {
            const { col, row } = SpreadsheetModel.parseCellRef(ref);
            if (row === rowNum) {
                // Skip this cell (delete it)
                continue;
            }

            const cellCopy = { ...cell };

            // Adjust formula references if this cell has an expression
            if (cellCopy.expression) {
                cellCopy.expression = this._adjustCellReferencesInExpression(
                    cellCopy.expression,
                    'deleteRow',
                    rowNum
                );
            }

            if (row > rowNum) {
                // Shift this cell up
                const newRef = SpreadsheetModel.formatCellRef(col, row - 1);
                newCells.set(newRef, cellCopy);
            } else {
                // Keep this cell where it is
                newCells.set(ref, cellCopy);
            }
        }

        // Replace cells map
        this.cells = newCells;

        // Rebuild dependents map
        this._rebuildDependents();

        // Recalculate all formulas if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Insert a column at the specified position
     * Shifts all columns at or to the right of the position right by 1
     */
    insertColumn(colNum, rexxInterpreter = null) {
        // Convert column number to letter if needed
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }

        if (colNum < 1 || colNum > this.cols) {
            throw new Error(`Invalid column number: ${colNum}. Must be between 1 and ${this.cols}`);
        }

        // Create a new map to hold updated cells
        const newCells = new Map();

        // Move cells right, processing from right to left to avoid overwrites
        for (const [ref, cell] of this.cells.entries()) {
            const { col, row } = SpreadsheetModel.parseCellRef(ref);
            const currentColNum = SpreadsheetModel.colLetterToNumber(col);
            const cellCopy = { ...cell };

            // Adjust formula references if this cell has an expression
            if (cellCopy.expression) {
                cellCopy.expression = this._adjustCellReferencesInExpression(
                    cellCopy.expression,
                    'insertColumn',
                    colNum
                );
            }

            if (currentColNum >= colNum) {
                // Shift this cell right
                const newRef = SpreadsheetModel.formatCellRef(currentColNum + 1, row);
                newCells.set(newRef, cellCopy);
            } else {
                // Keep this cell where it is
                newCells.set(ref, cellCopy);
            }
        }

        // Replace cells map
        this.cells = newCells;

        // Rebuild dependents map
        this._rebuildDependents();

        // Recalculate all formulas if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Delete a column at the specified position
     * Shifts all columns to the right of the position left by 1
     */
    deleteColumn(colNum, rexxInterpreter = null) {
        // Convert column number to letter if needed
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }

        if (colNum < 1 || colNum > this.cols) {
            throw new Error(`Invalid column number: ${colNum}. Must be between 1 and ${this.cols}`);
        }

        // Create a new map to hold updated cells
        const newCells = new Map();

        // Delete column and shift cells left
        for (const [ref, cell] of this.cells.entries()) {
            const { col, row } = SpreadsheetModel.parseCellRef(ref);
            const currentColNum = SpreadsheetModel.colLetterToNumber(col);

            if (currentColNum === colNum) {
                // Skip this cell (delete it)
                continue;
            }

            const cellCopy = { ...cell };

            // Adjust formula references if this cell has an expression
            if (cellCopy.expression) {
                cellCopy.expression = this._adjustCellReferencesInExpression(
                    cellCopy.expression,
                    'deleteColumn',
                    colNum
                );
            }

            if (currentColNum > colNum) {
                // Shift this cell left
                const newRef = SpreadsheetModel.formatCellRef(currentColNum - 1, row);
                newCells.set(newRef, cellCopy);
            } else {
                // Keep this cell where it is
                newCells.set(ref, cellCopy);
            }
        }

        // Replace cells map
        this.cells = newCells;

        // Rebuild dependents map
        this._rebuildDependents();

        // Recalculate all formulas if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Rebuild the dependents map from scratch based on current cells
     */
    _rebuildDependents() {
        this.dependents.clear();

        for (const [ref, cell] of this.cells.entries()) {
            if (cell.expression) {
                const dependencies = this.extractCellReferences(cell.expression);
                cell.dependencies = dependencies;

                dependencies.forEach(dep => {
                    if (!this.dependents.has(dep)) {
                        this.dependents.set(dep, new Set());
                    }
                    this.dependents.get(dep).add(ref);
                });
            }
        }
    }

    /**
     * Recalculate all formula cells
     */
    async _recalculateAll(rexxInterpreter) {
        for (const [ref, cell] of this.cells.entries()) {
            if (cell.expression) {
                await this.evaluateCell(ref, rexxInterpreter);
            }
        }
    }

    /**
     * Adjust cell references in an expression based on row/column operations
     * @param {string} expression - The formula expression
     * @param {string} operation - 'insertRow', 'deleteRow', 'insertColumn', 'deleteColumn'
     * @param {number} position - The row/column number where the operation occurs
     * @returns {string} - The adjusted expression
     */
    _adjustCellReferencesInExpression(expression, operation, position) {
        if (!expression) return expression;

        // Match both single cell references (A1) and range references (A1:B5)
        // This regex captures cell references with optional $ for absolute references
        const cellRefPattern = /(\$?)([A-Z]+)(\$?)(\d+)/g;

        return expression.replace(cellRefPattern, (match, colAbs, col, rowAbs, row) => {
            const rowNum = parseInt(row, 10);
            const colNum = SpreadsheetModel.colLetterToNumber(col);

            let newRow = rowNum;
            let newCol = col;

            switch (operation) {
                case 'insertRow':
                    // If the reference is at or below the insertion point, shift down
                    if (!rowAbs && rowNum >= position) {
                        newRow = rowNum + 1;
                    }
                    break;

                case 'deleteRow':
                    // If the reference is the deleted row, mark as invalid
                    if (rowNum === position) {
                        return '#REF!';
                    }
                    // If the reference is below the deleted row, shift up
                    if (!rowAbs && rowNum > position) {
                        newRow = rowNum - 1;
                    }
                    break;

                case 'insertColumn':
                    // If the reference is at or right of the insertion point, shift right
                    if (!colAbs && colNum >= position) {
                        newCol = SpreadsheetModel.colNumberToLetter(colNum + 1);
                    }
                    break;

                case 'deleteColumn':
                    // If the reference is the deleted column, mark as invalid
                    if (colNum === position) {
                        return '#REF!';
                    }
                    // If the reference is right of the deleted column, shift left
                    if (!colAbs && colNum > position) {
                        newCol = SpreadsheetModel.colNumberToLetter(colNum - 1);
                    }
                    break;
            }

            // Reconstruct the cell reference with absolute markers if present
            return `${colAbs}${newCol}${rowAbs}${newRow}`;
        });
    }

    /**
     * Auto-ID Column Management
     */

    /**
     * Configure auto-ID column for the current sheet
     * @param {string|null} column - Column letter (e.g., "A") or null to disable
     * @param {number} startId - Starting ID number (default: 1)
     * @param {string} prefix - Optional prefix for IDs (default: '')
     */
    configureAutoId(column, startId = 1, prefix = '') {
        if (column !== null && !/^[A-Z]+$/i.test(column)) {
            throw new Error(`Invalid column letter: ${column}`);
        }

        this.autoIdColumn = column ? column.toUpperCase() : null;
        this.nextId = startId;
        this.idPrefix = prefix;
    }

    /**
     * Find row number by ID value
     * @param {string|number} idValue - ID to search for
     * @returns {number|null} - Row number or null if not found
     */
    findRowById(idValue) {
        if (!this.autoIdColumn) {
            throw new Error('Auto-ID column is not configured for this sheet');
        }

        const searchValue = String(idValue);

        // Search through the auto-ID column
        for (let row = 1; row <= this.rows; row++) {
            const cellRef = `${this.autoIdColumn}${row}`;
            const cellValue = this.getCellValue(cellRef);

            if (String(cellValue) === searchValue) {
                return row;
            }
        }

        return null; // Not found
    }

    /**
     * Get the next ID that will be assigned
     * @returns {string} - Next ID value with prefix
     */
    getNextId() {
        return this.idPrefix + this.nextId;
    }

    /**
     * Sort a range of cells by a specific column
     * @param {string} rangeRef - Range like "A1:C5"
     * @param {number|string} sortCol - Column to sort by (1-based index or letter)
     * @param {boolean} ascending - Sort direction (default: true)
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    sortRange(rangeRef, sortCol, ascending = true, rexxInterpreter = null) {
        // Parse range reference
        const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) {
            throw new Error(`Invalid range reference: ${rangeRef}. Expected format: "A1:C5"`);
        }

        const startColLetter = match[1].toUpperCase();
        const startRow = parseInt(match[2], 10);
        const endColLetter = match[3].toUpperCase();
        const endRow = parseInt(match[4], 10);

        const startCol = SpreadsheetModel.colLetterToNumber(startColLetter);
        const endCol = SpreadsheetModel.colLetterToNumber(endColLetter);

        // Convert sortCol to number if needed
        const sortColNum = typeof sortCol === 'string' ?
            SpreadsheetModel.colLetterToNumber(sortCol) :
            sortCol;

        // Validate sort column is within range
        if (sortColNum < startCol || sortColNum > endCol) {
            throw new Error(`Sort column ${sortCol} is outside the range ${rangeRef}`);
        }

        // Extract all rows in the range
        const rows = [];
        for (let row = startRow; row <= endRow; row++) {
            const rowData = {
                rowNum: row,
                cells: {}
            };
            for (let col = startCol; col <= endCol; col++) {
                const ref = SpreadsheetModel.formatCellRef(col, row);
                const cell = this.getCell(ref);
                rowData.cells[col] = { ...cell };
            }
            rows.push(rowData);
        }

        // Sort rows by the sort column
        rows.sort((a, b) => {
            const aCell = a.cells[sortColNum];
            const bCell = b.cells[sortColNum];
            const aVal = aCell.value || '';
            const bVal = bCell.value || '';

            // Try numeric comparison first
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return ascending ? aNum - bNum : bNum - aNum;
            }

            // Fall back to string comparison
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            if (aStr < bStr) return ascending ? -1 : 1;
            if (aStr > bStr) return ascending ? 1 : -1;
            return 0;
        });

        // Write sorted rows back to the model
        for (let i = 0; i < rows.length; i++) {
            const targetRow = startRow + i;
            const sourceRow = rows[i];

            for (let col = startCol; col <= endCol; col++) {
                const targetRef = SpreadsheetModel.formatCellRef(col, targetRow);
                const sourceCell = sourceRow.cells[col];

                if (sourceCell.expression) {
                    // Preserve expression
                    const metadata = {
                        comment: sourceCell.comment || '',
                        format: sourceCell.format || '',
                        wrapText: sourceCell.wrapText || false
                    };
                    this.setCell(targetRef, '=' + sourceCell.expression, rexxInterpreter, metadata);
                } else if (sourceCell.value !== '') {
                    // Preserve value
                    const metadata = {
                        comment: sourceCell.comment || '',
                        format: sourceCell.format || '',
                        wrapText: sourceCell.wrapText || false
                    };
                    this.setCell(targetRef, sourceCell.value, rexxInterpreter, metadata);
                } else {
                    // Clear cell
                    this.setCell(targetRef, '', rexxInterpreter);
                }
            }
        }

        // Recalculate if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Fill down - Copy cell(s) down to a range
     * @param {string} sourceRef - Source cell or range (e.g., "A1" or "A1:B1")
     * @param {string} targetRangeRef - Target range (e.g., "A2:A10")
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    fillDown(sourceRef, targetRangeRef, rexxInterpreter = null) {
        // Parse source range
        const sourceMatch = sourceRef.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!sourceMatch) {
            throw new Error(`Invalid source reference: ${sourceRef}`);
        }

        const sourceStartCol = sourceMatch[1].toUpperCase();
        const sourceStartRow = parseInt(sourceMatch[2], 10);
        const sourceEndCol = sourceMatch[3] ? sourceMatch[3].toUpperCase() : sourceStartCol;
        const sourceEndRow = sourceMatch[4] ? parseInt(sourceMatch[4], 10) : sourceStartRow;

        // Parse target range
        const targetMatch = targetRangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!targetMatch) {
            throw new Error(`Invalid target range: ${targetRangeRef}`);
        }

        const targetStartCol = targetMatch[1].toUpperCase();
        const targetStartRow = parseInt(targetMatch[2], 10);
        const targetEndCol = targetMatch[3].toUpperCase();
        const targetEndRow = parseInt(targetMatch[4], 10);

        const sourceColStart = SpreadsheetModel.colLetterToNumber(sourceStartCol);
        const sourceColEnd = SpreadsheetModel.colLetterToNumber(sourceEndCol);
        const targetColStart = SpreadsheetModel.colLetterToNumber(targetStartCol);
        const targetColEnd = SpreadsheetModel.colLetterToNumber(targetEndCol);

        const sourceWidth = sourceColEnd - sourceColStart + 1;
        const targetWidth = targetColEnd - targetColStart + 1;

        if (sourceWidth !== targetWidth) {
            throw new Error('Source and target must have the same number of columns');
        }

        // Fill down
        for (let row = targetStartRow; row <= targetEndRow; row++) {
            for (let colOffset = 0; colOffset < sourceWidth; colOffset++) {
                const sourceCol = sourceColStart + colOffset;
                const targetCol = targetColStart + colOffset;
                const sourceRowToUse = sourceStartRow + ((row - targetStartRow) % (sourceEndRow - sourceStartRow + 1));

                const sourceCellRef = SpreadsheetModel.formatCellRef(sourceCol, sourceRowToUse);
                const targetCellRef = SpreadsheetModel.formatCellRef(targetCol, row);

                const sourceCell = this.getCell(sourceCellRef);
                if (sourceCell.expression) {
                    // Adjust formula for new position
                    const rowOffset = row - sourceRowToUse;
                    const colOffset = targetCol - sourceCol;
                    const adjustedExpression = this._adjustFormulaForCopy(sourceCell.expression, rowOffset, colOffset);
                    this.setCell(targetCellRef, '=' + adjustedExpression, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                } else {
                    this.setCell(targetCellRef, sourceCell.value, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                }
            }
        }
    }

    /**
     * Fill right - Copy cell(s) right to a range
     * @param {string} sourceRef - Source cell or range (e.g., "A1" or "A1:A2")
     * @param {string} targetRangeRef - Target range (e.g., "B1:E1")
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    fillRight(sourceRef, targetRangeRef, rexxInterpreter = null) {
        // Parse source range
        const sourceMatch = sourceRef.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!sourceMatch) {
            throw new Error(`Invalid source reference: ${sourceRef}`);
        }

        const sourceStartCol = sourceMatch[1].toUpperCase();
        const sourceStartRow = parseInt(sourceMatch[2], 10);
        const sourceEndCol = sourceMatch[3] ? sourceMatch[3].toUpperCase() : sourceStartCol;
        const sourceEndRow = sourceMatch[4] ? parseInt(sourceMatch[4], 10) : sourceStartRow;

        // Parse target range
        const targetMatch = targetRangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!targetMatch) {
            throw new Error(`Invalid target range: ${targetRangeRef}`);
        }

        const targetStartCol = targetMatch[1].toUpperCase();
        const targetStartRow = parseInt(targetMatch[2], 10);
        const targetEndCol = targetMatch[3].toUpperCase();
        const targetEndRow = parseInt(targetMatch[4], 10);

        const sourceColStart = SpreadsheetModel.colLetterToNumber(sourceStartCol);
        const sourceColEnd = SpreadsheetModel.colLetterToNumber(sourceEndCol);
        const targetColStart = SpreadsheetModel.colLetterToNumber(targetStartCol);
        const targetColEnd = SpreadsheetModel.colLetterToNumber(targetEndCol);

        const sourceHeight = sourceEndRow - sourceStartRow + 1;
        const targetHeight = targetEndRow - targetStartRow + 1;

        if (sourceHeight !== targetHeight) {
            throw new Error('Source and target must have the same number of rows');
        }

        // Fill right
        for (let col = targetColStart; col <= targetColEnd; col++) {
            for (let rowOffset = 0; rowOffset < sourceHeight; rowOffset++) {
                const sourceRow = sourceStartRow + rowOffset;
                const targetRow = targetStartRow + rowOffset;
                const sourceColToUse = sourceColStart + ((col - targetColStart) % (sourceColEnd - sourceColStart + 1));

                const sourceCellRef = SpreadsheetModel.formatCellRef(sourceColToUse, sourceRow);
                const targetCellRef = SpreadsheetModel.formatCellRef(col, targetRow);

                const sourceCell = this.getCell(sourceCellRef);
                if (sourceCell.expression) {
                    // Adjust formula for new position
                    const rowDiff = targetRow - sourceRow;
                    const colDiff = col - sourceColToUse;
                    const adjustedExpression = this._adjustFormulaForCopy(sourceCell.expression, rowDiff, colDiff);
                    this.setCell(targetCellRef, '=' + adjustedExpression, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                } else {
                    this.setCell(targetCellRef, sourceCell.value, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                }
            }
        }
    }

    /**
     * Adjust formula when copying (not inserting/deleting)
     * Only adjusts relative references
     */
    _adjustFormulaForCopy(expression, rowOffset, colOffset) {
        if (!expression) return expression;

        const cellRefPattern = /(\$?)([A-Z]+)(\$?)(\d+)/g;

        return expression.replace(cellRefPattern, (match, colAbs, col, rowAbs, row) => {
            const rowNum = parseInt(row, 10);
            const colNum = SpreadsheetModel.colLetterToNumber(col);

            const newRow = rowAbs ? rowNum : rowNum + rowOffset;
            const newCol = colAbs ? col : SpreadsheetModel.colNumberToLetter(colNum + colOffset);

            return `${colAbs}${newCol}${rowAbs}${newRow}`;
        });
    }

    /**
     * Find all cells matching criteria
     * @param {string} searchValue - Value to search for
     * @param {Object} options - { matchCase: boolean, matchEntireCell: boolean, searchFormulas: boolean }
     * @returns {Array} Array of cell references that match
     */
    find(searchValue, options = {}) {
        const {
            matchCase = false,
            matchEntireCell = false,
            searchFormulas = false
        } = options;

        const results = [];
        const searchStr = matchCase ? searchValue : searchValue.toLowerCase();

        for (const [ref, cell] of this.cells.entries()) {
            let textToSearch = searchFormulas && cell.expression ? cell.expression : cell.value;
            if (!matchCase) {
                textToSearch = String(textToSearch).toLowerCase();
            } else {
                textToSearch = String(textToSearch);
            }

            const matches = matchEntireCell
                ? textToSearch === searchStr
                : textToSearch.includes(searchStr);

            if (matches) {
                results.push(ref);
            }
        }

        return results;
    }

    /**
     * Replace all occurrences of a value
     * @param {string} searchValue - Value to search for
     * @param {string} replaceValue - Value to replace with
     * @param {Object} options - { matchCase, matchEntireCell, searchFormulas }
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     * @returns {number} Number of replacements made
     */
    replace(searchValue, replaceValue, options = {}, rexxInterpreter = null) {
        const {
            matchCase = false,
            matchEntireCell = false,
            searchFormulas = false
        } = options;

        let count = 0;

        for (const [ref, cell] of this.cells.entries()) {
            let textToReplace = searchFormulas && cell.expression ? cell.expression : cell.value;
            let originalText = textToReplace;

            if (matchEntireCell) {
                if (matchCase) {
                    if (textToReplace === searchValue) {
                        textToReplace = replaceValue;
                    }
                } else {
                    if (String(textToReplace).toLowerCase() === searchValue.toLowerCase()) {
                        textToReplace = replaceValue;
                    }
                }
            } else {
                if (matchCase) {
                    textToReplace = String(textToReplace).split(searchValue).join(replaceValue);
                } else {
                    const regex = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    textToReplace = String(textToReplace).replace(regex, replaceValue);
                }
            }

            if (textToReplace !== originalText) {
                if (searchFormulas && cell.expression) {
                    this.setCell(ref, '=' + textToReplace, rexxInterpreter, {
                        format: cell.format,
                        comment: cell.comment,
                        wrapText: cell.wrapText
                    });
                } else {
                    this.setCell(ref, textToReplace, rexxInterpreter, {
                        format: cell.format,
                        comment: cell.comment,
                        wrapText: cell.wrapText
                    });
                }
                count++;
            }
        }

        return count;
    }

    /**
     * Hide a row
     * @param {number} rowNum - Row number to hide
     */
    hideRow(rowNum) {
        if (rowNum < 1 || rowNum > this.rows) {
            throw new Error(`Invalid row number: ${rowNum}`);
        }
        this.hiddenRows.add(rowNum);
    }

    /**
     * Unhide a row
     * @param {number} rowNum - Row number to unhide
     */
    unhideRow(rowNum) {
        this.hiddenRows.delete(rowNum);
    }

    /**
     * Hide a column
     * @param {number|string} colNum - Column number or letter to hide
     */
    hideColumn(colNum) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }
        if (colNum < 1 || colNum > this.cols) {
            throw new Error(`Invalid column number: ${colNum}`);
        }
        this.hiddenColumns.add(colNum);
    }

    /**
     * Unhide a column
     * @param {number|string} colNum - Column number or letter to unhide
     */
    unhideColumn(colNum) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }
        this.hiddenColumns.delete(colNum);
    }

    /**
     * Check if a row is hidden
     */
    isRowHidden(rowNum) {
        return this.hiddenRows.has(rowNum);
    }

    /**
     * Check if a column is hidden
     */
    isColumnHidden(colNum) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }
        return this.hiddenColumns.has(colNum);
    }

    /**
     * Set column width
     * @param {number|string} colNum - Column number or letter
     * @param {number} width - Width in pixels (must be > 0)
     */
    setColumnWidth(colNum, width) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }
        if (colNum < 1 || colNum > this.cols) {
            throw new Error(`Invalid column number: ${colNum}`);
        }
        if (width <= 0) {
            throw new Error(`Width must be greater than 0: ${width}`);
        }
        this.columnWidths.set(colNum, width);
    }

    /**
     * Get column width
     * @param {number|string} colNum - Column number or letter
     * @returns {number} Width in pixels (default 100 if not set)
     */
    getColumnWidth(colNum) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }
        return this.columnWidths.get(colNum) || 100; // Default width 100px
    }

    /**
     * Set row height
     * @param {number} rowNum - Row number
     * @param {number} height - Height in pixels (must be > 0)
     */
    setRowHeight(rowNum, height) {
        if (rowNum < 1 || rowNum > this.rows) {
            throw new Error(`Invalid row number: ${rowNum}`);
        }
        if (height <= 0) {
            throw new Error(`Height must be greater than 0: ${height}`);
        }
        this.rowHeights.set(rowNum, height);
    }

    /**
     * Get row height
     * @param {number} rowNum - Row number
     * @returns {number} Height in pixels (default 32 if not set)
     */
    getRowHeight(rowNum) {
        return this.rowHeights.get(rowNum) || 32; // Default height 32px
    }

    /**
     * Define a named range
     * @param {string} name - Name for the range (e.g., "SalesData")
     * @param {string} rangeRef - Range reference (e.g., "A1:B10")
     */
    defineNamedRange(name, rangeRef) {
        // Validate name (alphanumeric, underscore, must start with letter)
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
            throw new Error('Named range must start with a letter and contain only letters, numbers, and underscores');
        }

        // Validate range reference
        const match = rangeRef.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!match) {
            throw new Error(`Invalid range reference: ${rangeRef}`);
        }

        this.namedRanges.set(name, rangeRef.toUpperCase());
    }

    /**
     * Delete a named range
     * @param {string} name - Name of the range to delete
     */
    deleteNamedRange(name) {
        this.namedRanges.delete(name);
    }

    /**
     * Get a named range reference
     * @param {string} name - Name of the range
     * @returns {string|null} Range reference or null if not found
     */
    getNamedRange(name) {
        return this.namedRanges.get(name) || null;
    }

    /**
     * Get all named ranges
     * @returns {Object} Object with name -> range mappings
     */
    getAllNamedRanges() {
        return Object.fromEntries(this.namedRanges);
    }

    /**
     * Resolve named ranges in an expression
     * @param {string} expression - Expression that may contain named ranges
     * @returns {string} Expression with named ranges replaced by cell references
     */
    resolveNamedRanges(expression) {
        if (!expression) return expression;

        // Replace named ranges with their cell references
        // Named ranges should match pattern: word boundary + name + word boundary
        for (const [name, rangeRef] of this.namedRanges.entries()) {
            const regex = new RegExp(`\\b${name}\\b`, 'g');
            expression = expression.replace(regex, rangeRef);
        }

        return expression;
    }

    /**
     * Set table metadata for a named range
     * @param {string} tableName - Name of the table (must match a named range or range reference)
     * @param {Object} metadata - Table metadata object
     * @param {string} metadata.range - Range reference (e.g., "A1:D100")
     * @param {Object} metadata.columns - Column name to column letter mappings (e.g., {id: "A", name: "B"})
     * @param {boolean} metadata.hasHeader - Whether the range has a header row
     * @param {Object} [metadata.types] - Optional column type information (e.g., {id: "number", name: "string"})
     * @param {Object} [metadata.descriptions] - Optional column descriptions
     */
    setTableMetadata(tableName, metadata) {
        // Validate table name
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(tableName)) {
            throw new Error('Table name must start with a letter and contain only letters, numbers, and underscores');
        }

        // Validate required fields
        if (!metadata.range || !metadata.columns) {
            throw new Error('Table metadata must include range and columns');
        }

        // Validate range reference
        const match = metadata.range.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!match) {
            throw new Error(`Invalid range reference: ${metadata.range}`);
        }

        // Validate columns object
        if (typeof metadata.columns !== 'object' || Array.isArray(metadata.columns)) {
            throw new Error('Columns must be an object mapping column names to column letters');
        }

        // Store the metadata
        this.tableMetadata.set(tableName, {
            range: metadata.range.toUpperCase(),
            columns: metadata.columns,
            hasHeader: metadata.hasHeader !== false, // Default to true
            types: metadata.types || {},
            descriptions: metadata.descriptions || {}
        });

        // Also create/update a named range for the table
        this.namedRanges.set(tableName, metadata.range.toUpperCase());
    }

    /**
     * Get table metadata
     * @param {string} tableName - Name of the table
     * @returns {Object|null} Table metadata or null if not found
     */
    getTableMetadata(tableName) {
        return this.tableMetadata.get(tableName) || null;
    }

    /**
     * Delete table metadata
     * @param {string} tableName - Name of the table
     */
    deleteTableMetadata(tableName) {
        this.tableMetadata.delete(tableName);
        // Optionally delete the associated named range
        this.namedRanges.delete(tableName);
    }

    /**
     * Get all table metadata
     * @returns {Object} Object with table name -> metadata mappings
     */
    getAllTableMetadata() {
        return Object.fromEntries(this.tableMetadata);
    }

    /**
     * List all table names
     * @returns {Array<string>} Array of table names
     */
    listTables() {
        return Array.from(this.tableMetadata.keys());
    }

    /**
     * Freeze panes - lock rows and columns in place
     * @param {number} rows - Number of rows to freeze from top
     * @param {number} cols - Number of columns to freeze from left
     */
    freezePanes(rows, cols) {
        if (rows < 0 || rows > this.rows) {
            throw new Error(`Invalid rows to freeze: ${rows}`);
        }
        if (cols < 0 || cols > this.cols) {
            throw new Error(`Invalid columns to freeze: ${cols}`);
        }
        this.frozenRows = rows;
        this.frozenColumns = cols;
    }

    /**
     * Unfreeze all panes
     */
    unfreezePanes() {
        this.frozenRows = 0;
        this.frozenColumns = 0;
    }

    /**
     * Get frozen pane settings
     * @returns {Object} {rows, columns}
     */
    getFrozenPanes() {
        return {
            rows: this.frozenRows,
            columns: this.frozenColumns
        };
    }

    /**
     * Set cell validation rules
     * @param {string} cellRef - Cell reference
     * @param {Object} validation - Validation rules
     */
    setCellValidation(cellRef, validation) {
        if (!validation) {
            this.validations.delete(cellRef);
            return;
        }

        // Validate the validation object
        if (!validation.type) {
            throw new Error('Validation must have a type');
        }

        const validTypes = ['list', 'number', 'date', 'text', 'custom', 'contextual'];
        if (!validTypes.includes(validation.type)) {
            throw new Error(`Invalid validation type: ${validation.type}`);
        }

        // For contextual validations, ensure at least one context rule exists
        if (validation.type === 'contextual') {
            if (!validation.onCreate && !validation.onUpdate && !validation.always) {
                throw new Error('Contextual validation requires at least one of: onCreate, onUpdate, or always');
            }
        }

        this.validations.set(cellRef, validation);
    }

    /**
     * Get cell validation rules
     * @param {string} cellRef - Cell reference
     * @returns {Object|null} Validation rules or null
     */
    getCellValidation(cellRef) {
        return this.validations.get(cellRef) || null;
    }

    /**
     * Validate a cell value against its validation rules
     * @param {string} cellRef - Cell reference
     * @param {string} value - Value to validate
     * @param {string} context - Validation context: 'create', 'update', or 'always' (default: 'always')
     * @param {Object} options - Optional: {interpreter, previousValue}
     * @returns {Object} {valid: boolean, message: string}
     */
    validateCellValue(cellRef, value, context = 'always', options = {}) {
        const validation = this.validations.get(cellRef);
        if (!validation) {
            return { valid: true, message: '' };
        }

        // Determine if this is create or update context
        const currentValue = this.getCellValue(cellRef);
        const isCreate = !currentValue || currentValue === '';
        const isUpdate = !isCreate;

        // Adjust context based on cell state if context is 'always'
        if (context === 'always') {
            context = isCreate ? 'create' : 'update';
        }

        // Handle contextual validation type
        if (validation.type === 'contextual') {
            return this._validateContextual(cellRef, value, context, validation, options);
        }

        // Standard validation types
        switch (validation.type) {
            case 'list':
                if (!validation.values || !Array.isArray(validation.values)) {
                    return { valid: false, message: 'Invalid list validation configuration' };
                }
                const valid = validation.values.includes(value);
                return {
                    valid,
                    message: valid ? '' : `Value must be one of: ${validation.values.join(', ')}`
                };

            case 'number':
                const num = parseFloat(value);
                if (isNaN(num)) {
                    return { valid: false, message: 'Value must be a number' };
                }
                if (validation.min !== undefined && num < validation.min) {
                    return { valid: false, message: `Value must be >= ${validation.min}` };
                }
                if (validation.max !== undefined && num > validation.max) {
                    return { valid: false, message: `Value must be <= ${validation.max}` };
                }
                return { valid: true, message: '' };

            case 'text':
                const text = String(value);
                if (validation.minLength !== undefined && text.length < validation.minLength) {
                    return { valid: false, message: `Text must be at least ${validation.minLength} characters` };
                }
                if (validation.maxLength !== undefined && text.length > validation.maxLength) {
                    return { valid: false, message: `Text must be at most ${validation.maxLength} characters` };
                }
                if (validation.pattern) {
                    const regex = new RegExp(validation.pattern);
                    if (!regex.test(text)) {
                        return { valid: false, message: `Text must match pattern: ${validation.pattern}` };
                    }
                }
                return { valid: true, message: '' };

            case 'custom':
                // Custom validation with a function (stored as string)
                if (!validation.formula) {
                    return { valid: false, message: 'Custom validation requires a formula' };
                }
                // For now, return valid - would need interpreter to evaluate
                return { valid: true, message: '' };

            default:
                return { valid: true, message: '' };
        }
    }

    /**
     * Validate contextual validation rules
     * @private
     */
    _validateContextual(cellRef, value, context, validation, options) {
        const results = [];

        // Always validate 'always' rules
        if (validation.always) {
            const result = this._evaluateValidationFormula(
                cellRef,
                value,
                validation.always,
                context,
                options
            );
            if (!result.valid) {
                return result;
            }
            results.push(result);
        }

        // Validate context-specific rules
        if (context === 'create' && validation.onCreate) {
            const result = this._evaluateValidationFormula(
                cellRef,
                value,
                validation.onCreate,
                context,
                options
            );
            if (!result.valid) {
                return result;
            }
            results.push(result);
        }

        if (context === 'update' && validation.onUpdate) {
            const result = this._evaluateValidationFormula(
                cellRef,
                value,
                validation.onUpdate,
                context,
                options
            );
            if (!result.valid) {
                return result;
            }
            results.push(result);
        }

        // All validations passed
        return { valid: true, message: '' };
    }

    /**
     * Evaluate a validation formula
     * @private
     */
    _evaluateValidationFormula(cellRef, value, formula, context, options) {
        try {
            // Simple expression evaluation
            // Support UNIQUE(range, value), PREVIOUS(cellRef), and simple comparisons

            // Handle UNIQUE(range, value) - check if value is unique in range
            const uniqueMatch = formula.match(/UNIQUE\(['"]([A-Z]+\d+:[A-Z]+\d+)['"]\s*,\s*(.+)\)/i);
            if (uniqueMatch) {
                const rangeRef = uniqueMatch[1];
                const checkValue = value; // Use the value being validated

                // Get all values in the range
                const [start, end] = rangeRef.split(':');
                const startParsed = SpreadsheetModel.parseCellRef(start);
                const endParsed = SpreadsheetModel.parseCellRef(end);

                const startCol = SpreadsheetModel.colLetterToNumber(startParsed.col);
                const endCol = SpreadsheetModel.colLetterToNumber(endParsed.col);
                const startRow = startParsed.row;
                const endRow = endParsed.row;

                // Check if value exists in range (excluding current cell)
                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        const ref = SpreadsheetModel.formatCellRef(col, row);
                        if (ref !== cellRef) {
                            const cellValue = this.getCellValue(ref);
                            if (cellValue === checkValue) {
                                return {
                                    valid: false,
                                    message: `Value "${checkValue}" must be unique in range ${rangeRef}`
                                };
                            }
                        }
                    }
                }

                return { valid: true, message: '' };
            }

            // Handle PREVIOUS(cellRef) - get previous value of cell
            const previousMatch = formula.match(/PREVIOUS\(['"]?(\w+)['"]\)/i);
            if (previousMatch) {
                const targetRef = previousMatch[1];
                const previousValue = options.previousValue !== undefined
                    ? options.previousValue
                    : this.getCellValue(targetRef);

                // Replace PREVIOUS() with the actual value
                const evaluableFormula = formula.replace(/PREVIOUS\([^)]+\)/i, previousValue);

                // Inject current value as a variable
                const finalFormula = evaluableFormula.replace(/\bvalue\b/gi, value);

                // Simple eval for comparisons
                try {
                    const result = eval(finalFormula);
                    return {
                        valid: result,
                        message: result ? '' : `Validation failed: ${formula}`
                    };
                } catch (e) {
                    return {
                        valid: false,
                        message: `Invalid validation formula: ${e.message}`
                    };
                }
            }

            // Simple expression evaluation (e.g., "value != ''", "value > 0")
            const evaluableFormula = formula.replace(/\bvalue\b/gi, `"${value}"`);
            const result = eval(evaluableFormula);

            return {
                valid: result,
                message: result ? '' : `Validation failed: ${formula}`
            };
        } catch (error) {
            return {
                valid: false,
                message: `Validation error: ${error.message}`
            };
        }
    }

    /**
     * Row Filtering Methods
     */

    /**
     * Apply a filter to show only rows that match criteria
     * @param {number} columnNum - Column to filter by (1-based)
     * @param {string|Function} criteria - Filter criteria (string, number, or function)
     */
    applyRowFilter(columnNum, criteria) {
        const sheet = this._getActiveSheet();
        const filteredRows = new Set();

        // Convert column number to letter if needed
        const colLetter = typeof columnNum === 'number' ?
            SpreadsheetModel.colNumberToLetter(columnNum) :
            columnNum;

        // Iterate through all rows
        for (let row = 1; row <= this.rows; row++) {
            const cellRef = SpreadsheetModel.formatCellRef(colLetter, row);
            const cell = this.getCell(cellRef);
            const value = cell.value;

            let matches = false;

            if (typeof criteria === 'function') {
                matches = criteria(value, row);
            } else if (typeof criteria === 'string') {
                // String matching (case-insensitive)
                matches = String(value).toLowerCase().includes(criteria.toLowerCase());
            } else {
                // Exact match
                matches = value == criteria;
            }

            if (matches) {
                filteredRows.add(row);
            }
        }

        sheet.filteredRows = filteredRows;
        sheet.filterCriteria = { column: columnNum, criteria };
    }

    /**
     * Clear all row filters
     */
    clearRowFilter() {
        const sheet = this._getActiveSheet();
        sheet.filteredRows = null;
        sheet.filterCriteria = null;
    }

    /**
     * Check if a row is visible (not filtered out)
     */
    isRowVisible(rowNum) {
        const sheet = this._getActiveSheet();
        if (sheet.filteredRows === null) {
            return true; // No filter applied
        }
        return sheet.filteredRows.has(rowNum);
    }

    /**
     * Get filter criteria
     */
    getFilterCriteria() {
        return this._getActiveSheet().filterCriteria;
    }

    /**
     * Column Reordering Methods
     */

    /**
     * Move a column left (swap with previous column)
     * @param {number|string} colNum - Column to move (1-based number or letter)
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    moveColumnLeft(colNum, rexxInterpreter = null) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }

        if (colNum <= 1) {
            throw new Error('Cannot move first column left');
        }

        this._swapColumns(colNum, colNum - 1, rexxInterpreter);
    }

    /**
     * Move a column right (swap with next column)
     * @param {number|string} colNum - Column to move (1-based number or letter)
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    moveColumnRight(colNum, rexxInterpreter = null) {
        if (typeof colNum === 'string') {
            colNum = SpreadsheetModel.colLetterToNumber(colNum);
        }

        if (colNum >= this.cols) {
            throw new Error('Cannot move last column right');
        }

        this._swapColumns(colNum, colNum + 1, rexxInterpreter);
    }

    /**
     * Swap two columns
     * @param {number} col1 - First column number (1-based)
     * @param {number} col2 - Second column number (1-based)
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    _swapColumns(col1, col2, rexxInterpreter = null) {
        const newCells = new Map();
        const col1Letter = SpreadsheetModel.colNumberToLetter(col1);
        const col2Letter = SpreadsheetModel.colNumberToLetter(col2);

        // Swap all cells in the two columns
        for (const [ref, cell] of this.cells.entries()) {
            const { col, row } = SpreadsheetModel.parseCellRef(ref);
            const colNum = SpreadsheetModel.colLetterToNumber(col);
            const cellCopy = { ...cell };

            // Adjust formula references if this cell has an expression
            if (cellCopy.expression) {
                cellCopy.expression = this._adjustCellReferencesForColumnSwap(
                    cellCopy.expression,
                    col1,
                    col2
                );
            }

            let newRef;
            if (colNum === col1) {
                // Move from col1 to col2
                newRef = SpreadsheetModel.formatCellRef(col2Letter, row);
            } else if (colNum === col2) {
                // Move from col2 to col1
                newRef = SpreadsheetModel.formatCellRef(col1Letter, row);
            } else {
                // Keep in same position
                newRef = ref;
            }

            newCells.set(newRef, cellCopy);
        }

        // Replace cells map
        this.cells = newCells;

        // Rebuild dependents map
        this._rebuildDependents();

        // Recalculate all formulas if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Adjust cell references in formulas when columns are swapped
     */
    _adjustCellReferencesForColumnSwap(expression, col1, col2) {
        if (!expression) return expression;

        const cellRefPattern = /(\$?)([A-Z]+)(\$?)(\d+)/g;

        return expression.replace(cellRefPattern, (match, colAbs, col, rowAbs, row) => {
            const colNum = SpreadsheetModel.colLetterToNumber(col);
            let newCol = col;

            if (!colAbs) { // Only adjust relative references
                if (colNum === col1) {
                    newCol = SpreadsheetModel.colNumberToLetter(col2);
                } else if (colNum === col2) {
                    newCol = SpreadsheetModel.colNumberToLetter(col1);
                }
            }

            return `${colAbs}${newCol}${rowAbs}${row}`;
        });
    }

    /**
     * Record a snapshot for undo
     */
    _recordSnapshot(action) {
        if (!this.recordingHistory) return;

        const snapshot = {
            action,
            cells: new Map(this.cells),
            hiddenRows: new Set(this.hiddenRows),
            hiddenColumns: new Set(this.hiddenColumns),
            namedRanges: new Map(this.namedRanges),
            frozenRows: this.frozenRows,
            frozenColumns: this.frozenColumns,
            validations: new Map(this.validations),
            mergedCells: new Map(this.mergedCells),
            cellEditors: new Map(this.cellEditors),
            pivotTables: new Map(this.pivotTables),
            tableMetadata: new Map(this.tableMetadata),
            autoIdColumn: this.autoIdColumn,
            nextId: this.nextId,
            idPrefix: this.idPrefix,
            timestamp: Date.now()
        };

        this.undoStack.push(snapshot);

        // Limit stack size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        // Clear redo stack when new action is recorded
        this.redoStack = [];
    }

    /**
     * Undo the last action
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     * @returns {boolean} True if undo was performed
     */
    undo(rexxInterpreter = null) {
        if (this.undoStack.length === 0) {
            return false;
        }

        // Save current state to redo stack
        const currentSnapshot = {
            action: 'redo',
            cells: new Map(this.cells),
            hiddenRows: new Set(this.hiddenRows),
            hiddenColumns: new Set(this.hiddenColumns),
            namedRanges: new Map(this.namedRanges),
            frozenRows: this.frozenRows,
            frozenColumns: this.frozenColumns,
            validations: new Map(this.validations),
            mergedCells: new Map(this.mergedCells),
            cellEditors: new Map(this.cellEditors),
            pivotTables: new Map(this.pivotTables),
            tableMetadata: new Map(this.tableMetadata),
            autoIdColumn: this.autoIdColumn,
            nextId: this.nextId,
            idPrefix: this.idPrefix,
            timestamp: Date.now()
        };
        this.redoStack.push(currentSnapshot);

        // Restore previous state
        const snapshot = this.undoStack.pop();
        this.recordingHistory = false;

        this.cells = new Map(snapshot.cells);
        this.hiddenRows = new Set(snapshot.hiddenRows);
        this.hiddenColumns = new Set(snapshot.hiddenColumns);
        this.namedRanges = new Map(snapshot.namedRanges);
        this.frozenRows = snapshot.frozenRows;
        this.frozenColumns = snapshot.frozenColumns;
        this.validations = new Map(snapshot.validations);
        this.mergedCells = new Map(snapshot.mergedCells || new Map());
        this.cellEditors = new Map(snapshot.cellEditors || new Map());
        this.pivotTables = new Map(snapshot.pivotTables || new Map());
        this.tableMetadata = new Map(snapshot.tableMetadata || new Map());
        this.autoIdColumn = snapshot.autoIdColumn !== undefined ? snapshot.autoIdColumn : null;
        this.nextId = snapshot.nextId !== undefined ? snapshot.nextId : 1;
        this.idPrefix = snapshot.idPrefix !== undefined ? snapshot.idPrefix : '';

        this._rebuildDependents();
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }

        this.recordingHistory = true;
        return true;
    }

    /**
     * Redo the last undone action
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     * @returns {boolean} True if redo was performed
     */
    redo(rexxInterpreter = null) {
        if (this.redoStack.length === 0) {
            return false;
        }

        // Save current state to undo stack
        const currentSnapshot = {
            action: 'undo',
            cells: new Map(this.cells),
            hiddenRows: new Set(this.hiddenRows),
            hiddenColumns: new Set(this.hiddenColumns),
            namedRanges: new Map(this.namedRanges),
            frozenRows: this.frozenRows,
            frozenColumns: this.frozenColumns,
            validations: new Map(this.validations),
            mergedCells: new Map(this.mergedCells),
            cellEditors: new Map(this.cellEditors),
            pivotTables: new Map(this.pivotTables),
            tableMetadata: new Map(this.tableMetadata),
            autoIdColumn: this.autoIdColumn,
            nextId: this.nextId,
            idPrefix: this.idPrefix,
            timestamp: Date.now()
        };
        this.undoStack.push(currentSnapshot);

        // Restore redo state
        const snapshot = this.redoStack.pop();
        this.recordingHistory = false;

        this.cells = new Map(snapshot.cells);
        this.hiddenRows = new Set(snapshot.hiddenRows);
        this.hiddenColumns = new Set(snapshot.hiddenColumns);
        this.namedRanges = new Map(snapshot.namedRanges);
        this.frozenRows = snapshot.frozenRows;
        this.frozenColumns = snapshot.frozenColumns;
        this.validations = new Map(snapshot.validations);
        this.mergedCells = new Map(snapshot.mergedCells || new Map());
        this.cellEditors = new Map(snapshot.cellEditors || new Map());
        this.pivotTables = new Map(snapshot.pivotTables || new Map());
        this.tableMetadata = new Map(snapshot.tableMetadata || new Map());
        this.autoIdColumn = snapshot.autoIdColumn !== undefined ? snapshot.autoIdColumn : null;
        this.nextId = snapshot.nextId !== undefined ? snapshot.nextId : 1;
        this.idPrefix = snapshot.idPrefix !== undefined ? snapshot.idPrefix : '';

        this._rebuildDependents();
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }

        this.recordingHistory = true;
        return true;
    }

    /**
     * Clear undo/redo history
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    // ========================================================================
    // Table Management (for sortable tables with headers)
    // ========================================================================

    /**
     * Define a table within the sheet
     * @param {string} name - Table name (e.g., "SalesData")
     * @param {string} range - Range reference (e.g., "A1:C10")
     * @param {boolean} hasHeader - Whether first row is a header (default: true)
     * @returns {Object} Table metadata
     */
    defineTable(name, range, hasHeader = true) {
        const sheet = this._getActiveSheet();

        // Validate range format
        const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) {
            throw new Error(`Invalid range reference: ${range}. Expected format: "A1:C10"`);
        }

        const startColLetter = match[1].toUpperCase();
        const startRow = parseInt(match[2], 10);
        const endColLetter = match[3].toUpperCase();
        const endRow = parseInt(match[4], 10);

        const startCol = SpreadsheetModel.colLetterToNumber(startColLetter);
        const endCol = SpreadsheetModel.colLetterToNumber(endColLetter);

        // Extract header row if applicable
        const headers = [];
        if (hasHeader) {
            for (let col = startCol; col <= endCol; col++) {
                const headerRef = SpreadsheetModel.formatCellRef(col, startRow);
                const headerCell = this.getCell(headerRef);
                headers.push(headerCell.value || SpreadsheetModel.colNumberToLetter(col));
            }
        }

        // Store original row order for restoration
        const originalOrder = [];
        const dataStartRow = hasHeader ? startRow + 1 : startRow;
        for (let row = dataStartRow; row <= endRow; row++) {
            originalOrder.push(row);
        }

        const tableMetadata = {
            name,
            range,
            startCol,
            endCol,
            startRow,
            endRow,
            hasHeader,
            headers,
            originalOrder,  // Track original row order for restoration
            currentSortColumn: null,  // null = unsorted
            currentSortDirection: null  // null | 'asc' | 'desc'
        };

        sheet.tableMetadata.set(name, tableMetadata);
        return tableMetadata;
    }

    /**
     * Delete a table definition
     * @param {string} name - Table name
     */
    deleteTable(name) {
        const sheet = this._getActiveSheet();
        if (!sheet.tableMetadata.has(name)) {
            throw new Error(`Table ${name} does not exist`);
        }
        sheet.tableMetadata.delete(name);
    }

    /**
     * Get table metadata
     * @param {string} name - Table name
     * @returns {Object} Table metadata
     */
    getTable(name) {
        const sheet = this._getActiveSheet();
        return sheet.tableMetadata.get(name);
    }

    /**
     * Get all table names
     * @returns {Array<string>} Array of table names
     */
    getTables() {
        const sheet = this._getActiveSheet();
        return Array.from(sheet.tableMetadata.keys());
    }

    /**
     * Sort table by column with state cycling (original → asc → desc → original)
     * @param {string} tableName - Name of the table
     * @param {string} columnLetter - Column to sort by (e.g., "A", "B")
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     * @returns {string} New sort state: 'asc', 'desc', or 'original'
     */
    sortTableByColumn(tableName, columnLetter, rexxInterpreter = null) {
        const sheet = this._getActiveSheet();
        const table = sheet.tableMetadata.get(tableName);

        if (!table) {
            throw new Error(`Table ${tableName} does not exist`);
        }

        const sortCol = SpreadsheetModel.colLetterToNumber(columnLetter.toUpperCase());

        // Validate sort column is within table range
        if (sortCol < table.startCol || sortCol > table.endCol) {
            throw new Error(`Column ${columnLetter} is outside table range`);
        }

        // Determine next sort state
        let newSortState;
        let newDirection;

        if (table.currentSortColumn !== columnLetter) {
            // Sorting by a different column - start with ascending
            newSortState = 'asc';
            newDirection = true;
        } else {
            // Same column - cycle through states
            if (table.currentSortDirection === null) {
                // original → ascending
                newSortState = 'asc';
                newDirection = true;
            } else if (table.currentSortDirection === 'asc') {
                // ascending → descending
                newSortState = 'desc';
                newDirection = false;
            } else {
                // descending → original
                newSortState = 'original';
                newDirection = null;
            }
        }

        const dataStartRow = table.hasHeader ? table.startRow + 1 : table.startRow;
        const dataEndRow = table.endRow;

        if (newSortState === 'original') {
            // Restore original order
            this._restoreTableOrder(table, rexxInterpreter);
            table.currentSortColumn = null;
            table.currentSortDirection = null;
        } else {
            // Perform sort
            const dataRange = `${SpreadsheetModel.colNumberToLetter(table.startCol)}${dataStartRow}:${SpreadsheetModel.colNumberToLetter(table.endCol)}${dataEndRow}`;
            this._sortTableRange(table, dataRange, columnLetter, newDirection, rexxInterpreter);
            table.currentSortColumn = columnLetter;
            table.currentSortDirection = newSortState;
        }

        return newSortState;
    }

    /**
     * Internal: Sort a table range and update formula references
     */
    _sortTableRange(table, rangeRef, sortCol, ascending, rexxInterpreter) {
        const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) {
            throw new Error(`Invalid range reference: ${rangeRef}`);
        }

        const startColLetter = match[1].toUpperCase();
        const startRow = parseInt(match[2], 10);
        const endColLetter = match[3].toUpperCase();
        const endRow = parseInt(match[4], 10);

        const startCol = SpreadsheetModel.colLetterToNumber(startColLetter);
        const endCol = SpreadsheetModel.colLetterToNumber(endColLetter);
        const sortColNum = typeof sortCol === 'string' ?
            SpreadsheetModel.colLetterToNumber(sortCol) :
            sortCol;

        // Extract all rows in the range
        const rows = [];
        for (let row = startRow; row <= endRow; row++) {
            const rowData = {
                rowNum: row,
                cells: {}
            };
            for (let col = startCol; col <= endCol; col++) {
                const ref = SpreadsheetModel.formatCellRef(col, row);
                const cell = this.getCell(ref);
                rowData.cells[col] = { ...cell };
            }
            rows.push(rowData);
        }

        // Sort rows by the sort column
        rows.sort((a, b) => {
            const aCell = a.cells[sortColNum];
            const bCell = b.cells[sortColNum];
            const aVal = aCell.value || '';
            const bVal = bCell.value || '';

            // Try numeric comparison first
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return ascending ? aNum - bNum : bNum - aNum;
            }

            // Fall back to string comparison
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            if (aStr < bStr) return ascending ? -1 : 1;
            if (aStr > bStr) return ascending ? 1 : -1;
            return 0;
        });

        // Create row mapping (old row -> new row)
        const rowMapping = new Map();
        for (let i = 0; i < rows.length; i++) {
            const oldRow = rows[i].rowNum;
            const newRow = startRow + i;
            rowMapping.set(oldRow, newRow);
        }

        // Write sorted rows back to the model
        for (let i = 0; i < rows.length; i++) {
            const targetRow = startRow + i;
            const sourceRow = rows[i];

            for (let col = startCol; col <= endCol; col++) {
                const targetRef = SpreadsheetModel.formatCellRef(col, targetRow);
                const sourceCell = sourceRow.cells[col];

                if (sourceCell.expression) {
                    // Update formula references based on row movement
                    const adjustedExpression = this._updateFormulaAfterRowMove(
                        sourceCell.expression,
                        sourceRow.rowNum,
                        targetRow,
                        rowMapping,
                        startRow,
                        endRow
                    );

                    const metadata = {
                        comment: sourceCell.comment || '',
                        format: sourceCell.format || '',
                        wrapText: sourceCell.wrapText || false
                    };
                    this.setCell(targetRef, '=' + adjustedExpression, rexxInterpreter, metadata);
                } else if (sourceCell.value !== '') {
                    const metadata = {
                        comment: sourceCell.comment || '',
                        format: sourceCell.format || '',
                        wrapText: sourceCell.wrapText || false
                    };
                    this.setCell(targetRef, sourceCell.value, rexxInterpreter, metadata);
                } else {
                    this.setCell(targetRef, '', rexxInterpreter);
                }
            }
        }

        // Recalculate if interpreter provided
        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    /**
     * Update formula references after rows have moved
     * This handles references to cells within the sorted range
     */
    _updateFormulaAfterRowMove(expression, oldRow, newRow, rowMapping, rangeStart, rangeEnd) {
        if (!expression) return expression;

        const cellRefPattern = /(\$?)([A-Z]+)(\$?)(\d+)/g;

        return expression.replace(cellRefPattern, (match, colAbs, col, rowAbs, row) => {
            const refRow = parseInt(row, 10);

            // If this reference is within the sorted range and not absolute
            if (!rowAbs && refRow >= rangeStart && refRow <= rangeEnd) {
                // If the referenced row was moved, update to its new position
                const newRefRow = rowMapping.get(refRow);
                if (newRefRow !== undefined) {
                    return `${colAbs}${col}${rowAbs}${newRefRow}`;
                }
            }

            // Keep reference as-is
            return match;
        });
    }

    /**
     * Restore table to original order
     */
    _restoreTableOrder(table, rexxInterpreter) {
        const dataStartRow = table.hasHeader ? table.startRow + 1 : table.startRow;
        const startCol = table.startCol;
        const endCol = table.endCol;

        // Extract all current rows
        const rows = [];
        for (let i = 0; i < table.originalOrder.length; i++) {
            const currentRow = dataStartRow + i;
            const rowData = {
                currentRowNum: currentRow,
                originalRowNum: table.originalOrder[i],
                cells: {}
            };
            for (let col = startCol; col <= endCol; col++) {
                const ref = SpreadsheetModel.formatCellRef(col, currentRow);
                const cell = this.getCell(ref);
                rowData.cells[col] = { ...cell };
            }
            rows.push(rowData);
        }

        // Sort by original row number
        rows.sort((a, b) => a.originalRowNum - b.originalRowNum);

        // Create row mapping for formula updates
        const rowMapping = new Map();
        for (let i = 0; i < rows.length; i++) {
            const oldRow = rows[i].currentRowNum;
            const newRow = dataStartRow + i;
            rowMapping.set(oldRow, newRow);
        }

        // Write rows back in original order
        for (let i = 0; i < rows.length; i++) {
            const targetRow = dataStartRow + i;
            const sourceRow = rows[i];

            for (let col = startCol; col <= endCol; col++) {
                const targetRef = SpreadsheetModel.formatCellRef(col, targetRow);
                const sourceCell = sourceRow.cells[col];

                if (sourceCell.expression) {
                    // Update formula references
                    const adjustedExpression = this._updateFormulaAfterRowMove(
                        sourceCell.expression,
                        sourceRow.currentRowNum,
                        targetRow,
                        rowMapping,
                        dataStartRow,
                        table.endRow
                    );

                    const metadata = {
                        comment: sourceCell.comment || '',
                        format: sourceCell.format || '',
                        wrapText: sourceCell.wrapText || false
                    };
                    this.setCell(targetRef, '=' + adjustedExpression, rexxInterpreter, metadata);
                } else if (sourceCell.value !== '') {
                    const metadata = {
                        comment: sourceCell.comment || '',
                        format: sourceCell.format || '',
                        wrapText: sourceCell.wrapText || false
                    };
                    this.setCell(targetRef, sourceCell.value, rexxInterpreter, metadata);
                } else {
                    this.setCell(targetRef, '', rexxInterpreter);
                }
            }
        }

        if (rexxInterpreter) {
            this._recalculateAll(rexxInterpreter);
        }
    }

    // ========================================================================
    // Autofill in All Directions
    // ========================================================================

    /**
     * Fill up - Copy cell(s) upward to a range
     * @param {string} sourceRef - Source cell or range (e.g., "A5" or "A4:A5")
     * @param {string} targetRangeRef - Target range (e.g., "A1:A3")
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    fillUp(sourceRef, targetRangeRef, rexxInterpreter = null) {
        // Parse source range
        const sourceMatch = sourceRef.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!sourceMatch) {
            throw new Error(`Invalid source reference: ${sourceRef}`);
        }

        const sourceStartCol = sourceMatch[1].toUpperCase();
        const sourceStartRow = parseInt(sourceMatch[2], 10);
        const sourceEndCol = sourceMatch[3] ? sourceMatch[3].toUpperCase() : sourceStartCol;
        const sourceEndRow = sourceMatch[4] ? parseInt(sourceMatch[4], 10) : sourceStartRow;

        // Parse target range
        const targetMatch = targetRangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!targetMatch) {
            throw new Error(`Invalid target range: ${targetRangeRef}`);
        }

        const targetStartCol = targetMatch[1].toUpperCase();
        const targetStartRow = parseInt(targetMatch[2], 10);
        const targetEndCol = targetMatch[3].toUpperCase();
        const targetEndRow = parseInt(targetMatch[4], 10);

        const sourceColStart = SpreadsheetModel.colLetterToNumber(sourceStartCol);
        const sourceColEnd = SpreadsheetModel.colLetterToNumber(sourceEndCol);
        const targetColStart = SpreadsheetModel.colLetterToNumber(targetStartCol);
        const targetColEnd = SpreadsheetModel.colLetterToNumber(targetEndCol);

        const sourceWidth = sourceColEnd - sourceColStart + 1;
        const targetWidth = targetColEnd - targetColStart + 1;

        if (sourceWidth !== targetWidth) {
            throw new Error('Source and target must have the same number of columns');
        }

        // Fill up (reverse direction)
        for (let row = targetEndRow; row >= targetStartRow; row--) {
            for (let colOffset = 0; colOffset < sourceWidth; colOffset++) {
                const sourceCol = sourceColStart + colOffset;
                const targetCol = targetColStart + colOffset;
                const sourceRowToUse = sourceEndRow - ((targetEndRow - row) % (sourceEndRow - sourceStartRow + 1));

                const sourceCellRef = SpreadsheetModel.formatCellRef(sourceCol, sourceRowToUse);
                const targetCellRef = SpreadsheetModel.formatCellRef(targetCol, row);

                const sourceCell = this.getCell(sourceCellRef);
                if (sourceCell.expression) {
                    // Adjust formula for new position
                    const rowOffset = row - sourceRowToUse;
                    const colOffset = targetCol - sourceCol;
                    const adjustedExpression = this._adjustFormulaForCopy(sourceCell.expression, rowOffset, colOffset);
                    this.setCell(targetCellRef, '=' + adjustedExpression, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                } else {
                    this.setCell(targetCellRef, sourceCell.value, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                }
            }
        }
    }

    /**
     * Fill left - Copy cell(s) leftward to a range
     * @param {string} sourceRef - Source cell or range (e.g., "E1" or "D1:E1")
     * @param {string} targetRangeRef - Target range (e.g., "A1:C1")
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    fillLeft(sourceRef, targetRangeRef, rexxInterpreter = null) {
        // Parse source range
        const sourceMatch = sourceRef.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
        if (!sourceMatch) {
            throw new Error(`Invalid source reference: ${sourceRef}`);
        }

        const sourceStartCol = sourceMatch[1].toUpperCase();
        const sourceStartRow = parseInt(sourceMatch[2], 10);
        const sourceEndCol = sourceMatch[3] ? sourceMatch[3].toUpperCase() : sourceStartCol;
        const sourceEndRow = sourceMatch[4] ? parseInt(sourceMatch[4], 10) : sourceStartRow;

        // Parse target range
        const targetMatch = targetRangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!targetMatch) {
            throw new Error(`Invalid target range: ${targetRangeRef}`);
        }

        const targetStartCol = targetMatch[1].toUpperCase();
        const targetStartRow = parseInt(targetMatch[2], 10);
        const targetEndCol = targetMatch[3].toUpperCase();
        const targetEndRow = parseInt(targetMatch[4], 10);

        const sourceColStart = SpreadsheetModel.colLetterToNumber(sourceStartCol);
        const sourceColEnd = SpreadsheetModel.colLetterToNumber(sourceEndCol);
        const targetColStart = SpreadsheetModel.colLetterToNumber(targetStartCol);
        const targetColEnd = SpreadsheetModel.colLetterToNumber(targetEndCol);

        const sourceHeight = sourceEndRow - sourceStartRow + 1;
        const targetHeight = targetEndRow - targetStartRow + 1;

        if (sourceHeight !== targetHeight) {
            throw new Error('Source and target must have the same number of rows');
        }

        // Fill left (iterate left-to-right, but map to source right-to-left)
        for (let col = targetColStart; col <= targetColEnd; col++) {
            for (let rowOffset = 0; rowOffset < sourceHeight; rowOffset++) {
                const sourceRow = sourceStartRow + rowOffset;
                const targetRow = targetStartRow + rowOffset;
                const sourceColToUse = sourceColStart + ((targetColEnd - col) % (sourceColEnd - sourceColStart + 1));

                const sourceCellRef = SpreadsheetModel.formatCellRef(sourceColToUse, sourceRow);
                const targetCellRef = SpreadsheetModel.formatCellRef(col, targetRow);

                const sourceCell = this.getCell(sourceCellRef);
                if (sourceCell.expression) {
                    // Adjust formula for new position
                    const rowDiff = targetRow - sourceRow;
                    const colDiff = col - sourceColToUse;
                    const adjustedExpression = this._adjustFormulaForCopy(sourceCell.expression, rowDiff, colDiff);
                    this.setCell(targetCellRef, '=' + adjustedExpression, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                } else {
                    this.setCell(targetCellRef, sourceCell.value, rexxInterpreter, {
                        format: sourceCell.format,
                        comment: sourceCell.comment,
                        wrapText: sourceCell.wrapText
                    });
                }
            }
        }
    }

    /**
     * Generic autofill that detects patterns and fills in any direction
     * @param {string} sourceRange - Source range (e.g., "A1:A3")
     * @param {string} targetRange - Target range (e.g., "A4:A10")
     * @param {Object} rexxInterpreter - Optional interpreter for recalculation
     */
    autofill(sourceRange, targetRange, rexxInterpreter = null) {
        // Determine direction based on source and target ranges
        const sourceMatch = sourceRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        const targetMatch = targetRange.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);

        if (!sourceMatch || !targetMatch) {
            throw new Error('Invalid range format. Use format like "A1:A3"');
        }

        const sourceStartCol = SpreadsheetModel.colLetterToNumber(sourceMatch[1].toUpperCase());
        const sourceStartRow = parseInt(sourceMatch[2], 10);
        const sourceEndCol = SpreadsheetModel.colLetterToNumber(sourceMatch[3].toUpperCase());
        const sourceEndRow = parseInt(sourceMatch[4], 10);

        const targetStartCol = SpreadsheetModel.colLetterToNumber(targetMatch[1].toUpperCase());
        const targetStartRow = parseInt(targetMatch[2], 10);
        const targetEndCol = SpreadsheetModel.colLetterToNumber(targetMatch[3].toUpperCase());
        const targetEndRow = parseInt(targetMatch[4], 10);

        // Detect direction
        let direction;
        if (targetStartRow > sourceEndRow) {
            direction = 'down';
        } else if (targetEndRow < sourceStartRow) {
            direction = 'up';
        } else if (targetStartCol > sourceEndCol) {
            direction = 'right';
        } else if (targetEndCol < sourceStartCol) {
            direction = 'left';
        } else {
            throw new Error('Target range must be adjacent to source range');
        }

        // Use existing fill methods based on direction
        switch (direction) {
            case 'down':
                this.fillDown(sourceRange, targetRange, rexxInterpreter);
                break;
            case 'up':
                this.fillUp(sourceRange, targetRange, rexxInterpreter);
                break;
            case 'right':
                this.fillRight(sourceRange, targetRange, rexxInterpreter);
                break;
            case 'left':
                this.fillLeft(sourceRange, targetRange, rexxInterpreter);
                break;
        }
    }
}

// Export for Node.js (Jest), ES6 modules, and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpreadsheetModel;
}

export default SpreadsheetModel;
