// SPDX-License-Identifier: MIT
// Calcudoku's rules, puzzles and solver, from Tsyne's ported-apps/calcudoku
// (calcudoku.ts at ae3b8d44). MIT, portions copyright Paul Hammant 2026
// (see ../NOTICE.md). Changes: the UI callbacks (onUpdate, onWin) are gone,
// since the page reads the game after each move; nothing else.

export type Op = '+' | '-' | '×' | '÷' | '=';

export interface Cage {
  cells: number[];
  target: number;
  op: Op;
}

export interface Puzzle {
  size: number;
  cages: Cage[];
}

// Pre-verified solvable puzzles with their solutions
// Grid positions: row * size + col
export const PUZZLES: Puzzle[] = [
  // 3x3 Easy - Solution: [1,3,2, 3,2,1, 2,1,3]
  {
    size: 3,
    cages: [
      { cells: [0, 1], target: 4, op: '+' },      // 1+3=4
      { cells: [2], target: 2, op: '=' },          // 2
      { cells: [3, 4], target: 5, op: '+' },       // 3+2=5
      { cells: [5, 8], target: 4, op: '+' },       // 1+3=4
      { cells: [6, 7], target: 3, op: '+' },       // 2+1=3
    ],
  },
  // 4x4 Easy - Solution: [1,2,3,4, 2,1,4,3, 3,4,1,2, 4,3,2,1]
  {
    size: 4,
    cages: [
      { cells: [0, 1], target: 3, op: '+' },       // 1+2=3
      { cells: [2, 3], target: 7, op: '+' },       // 3+4=7
      { cells: [4, 5], target: 3, op: '+' },       // 2+1=3
      { cells: [6, 7], target: 7, op: '+' },       // 4+3=7
      { cells: [8, 9], target: 7, op: '+' },       // 3+4=7
      { cells: [10, 11], target: 3, op: '+' },     // 1+2=3
      { cells: [12, 13], target: 7, op: '+' },     // 4+3=7
      { cells: [14, 15], target: 3, op: '+' },     // 2+1=3
    ],
  },
  // 4x4 Medium - Solution: [1,2,3,4, 3,4,1,2, 4,3,2,1, 2,1,4,3]
  {
    size: 4,
    cages: [
      { cells: [0, 4], target: 4, op: '+' },       // 1+3=4
      { cells: [1, 2], target: 6, op: '×' },       // 2×3=6
      { cells: [3, 7], target: 6, op: '+' },       // 4+2=6
      { cells: [5, 6, 9], target: 8, op: '+' },    // 4+1+3=8
      { cells: [8, 12], target: 6, op: '+' },      // 4+2=6
      { cells: [10, 11], target: 3, op: '+' },     // 2+1=3
      { cells: [13, 14, 15], target: 8, op: '+' }, // 1+4+3=8
    ],
  },
  // 5x5 Medium - Solution: [1,2,3,4,5, 2,3,4,5,1, 3,4,5,1,2, 4,5,1,2,3, 5,1,2,3,4]
  {
    size: 5,
    cages: [
      { cells: [0, 1], target: 3, op: '+' },       // 1+2=3
      { cells: [2, 3], target: 7, op: '+' },       // 3+4=7
      { cells: [4], target: 5, op: '=' },          // 5
      { cells: [5, 6], target: 5, op: '+' },       // 2+3=5
      { cells: [7, 8], target: 9, op: '+' },       // 4+5=9
      { cells: [9], target: 1, op: '=' },          // 1
      { cells: [10, 11], target: 7, op: '+' },     // 3+4=7
      { cells: [12, 13], target: 6, op: '+' },     // 5+1=6
      { cells: [14], target: 2, op: '=' },         // 2
      { cells: [15, 16], target: 9, op: '+' },     // 4+5=9
      { cells: [17, 18], target: 3, op: '+' },     // 1+2=3
      { cells: [19], target: 3, op: '=' },         // 3
      { cells: [20, 21], target: 6, op: '+' },     // 5+1=6
      { cells: [22, 23], target: 5, op: '+' },     // 2+3=5
      { cells: [24], target: 4, op: '=' },         // 4
    ],
  },
  // 5x5 Hard - Solution: [1,2,3,4,5, 3,4,5,1,2, 5,1,2,3,4, 2,3,4,5,1, 4,5,1,2,3]
  {
    size: 5,
    cages: [
      { cells: [0, 5, 10], target: 9, op: '+' },   // 1+3+5=9
      { cells: [1, 2], target: 6, op: '×' },       // 2×3=6
      { cells: [3, 4, 9], target: 11, op: '+' },   // 4+5+2=11
      { cells: [6, 7, 8], target: 20, op: '×' },   // 4×5×1=20
      { cells: [11, 16], target: 4, op: '+' },     // 1+3=4
      { cells: [12, 13], target: 5, op: '+' },     // 2+3=5
      { cells: [14, 19], target: 5, op: '+' },     // 4+1=5
      { cells: [15, 20], target: 6, op: '+' },     // 2+4=6
      { cells: [17, 18], target: 9, op: '+' },     // 4+5=9
      { cells: [21, 22], target: 6, op: '+' },     // 5+1=6
      { cells: [23, 24], target: 5, op: '+' },     // 2+3=5
    ],
  },
];

// ============================================================================
// Game Logic
// ============================================================================

export class CalcudokuGame {
  private puzzle: Puzzle;
  private board: number[] = [];
  private size = 3;
  private level = 0;
  private selected: number | null = null;
  
  constructor() {
    this.puzzle = PUZZLES[0];
    this.size = this.puzzle.size;
    this.reset();
  }

  reset = (): void => {
    this.board = Array(this.size * this.size).fill(0);
    this.selected = null;
  };

  setLevel = (level: number): void => {
    this.level = Math.max(0, Math.min(level, PUZZLES.length - 1));
    this.puzzle = PUZZLES[this.level];
    this.size = this.puzzle.size;
    this.reset();
  };

  nextLevel = (): void => this.setLevel(this.level + 1);
  prevLevel = (): void => this.setLevel(this.level - 1);

  getLevel = (): number => this.level;
  getLevelCount = (): number => PUZZLES.length;
  getSize = (): number => this.size;
  getValue = (pos: number): number => this.board[pos];
  getSelected = (): number | null => this.selected;
  getCages = (): readonly Cage[] => this.puzzle.cages;

  getCageForCell = (pos: number): Cage | undefined =>
    this.puzzle.cages.find(c => c.cells.includes(pos));

  isCageTopLeft = (pos: number): boolean => {
    const cage = this.getCageForCell(pos);
    return cage ? cage.cells[0] === pos : false;
  };

  selectCell = (pos: number): void => {
    this.selected = this.selected === pos ? null : pos;
  };

  setValue = (value: number): void => {
    if (this.selected === null) return;
    this.board[this.selected] = value;
  };

  clearCell = (): void => {
    if (this.selected === null) return;
    this.board[this.selected] = 0;
  };

  private getRow = (r: number): number[] =>
    Array.from({ length: this.size }, (_, c) => this.board[r * this.size + c]);

  private getCol = (c: number): number[] =>
    Array.from({ length: this.size }, (_, r) => this.board[r * this.size + c]);

  private checkCage = (cage: Cage): boolean => {
    const vals = cage.cells.map(i => this.board[i]);
    if (vals.includes(0)) return true; // Incomplete, not wrong

    if (cage.op === '=') return vals[0] === cage.target;

    if (cage.op === '+') return vals.reduce((a, b) => a + b, 0) === cage.target;

    if (cage.op === '×') return vals.reduce((a, b) => a * b, 1) === cage.target;

    if (cage.op === '-') {
      const sorted = [...vals].sort((a, b) => b - a);
      return sorted[0] - sorted.slice(1).reduce((a, b) => a + b, 0) === cage.target;
    }

    if (cage.op === '÷') {
      const sorted = [...vals].sort((a, b) => b - a);
      let result = sorted[0];
      for (let i = 1; i < sorted.length; i++) result /= sorted[i];
      return result === cage.target;
    }

    return false;
  };

  private checkRowCol = (): boolean => {
    for (let i = 0; i < this.size; i++) {
      const row = this.getRow(i).filter(v => v > 0);
      const col = this.getCol(i).filter(v => v > 0);
      if (new Set(row).size !== row.length) return false;
      if (new Set(col).size !== col.length) return false;
    }
    return true;
  };

  isValid = (): boolean => {
    if (!this.checkRowCol()) return false;
    return this.puzzle.cages.every(c => this.checkCage(c));
  };

  isFull = (): boolean => !this.board.includes(0);

  isWon = (): boolean => this.isFull() && this.isValid();

  getErrors = (): Set<number> => {
    const errors = new Set<number>();

    // Check rows and columns for duplicates
    for (let i = 0; i < this.size; i++) {
      const row = this.getRow(i);
      const col = this.getCol(i);
      const rowSeen = new Map<number, number[]>();
      const colSeen = new Map<number, number[]>();

      row.forEach((v, c) => {
        if (v > 0) {
          if (!rowSeen.has(v)) rowSeen.set(v, []);
          rowSeen.get(v)!.push(i * this.size + c);
        }
      });

      col.forEach((v, r) => {
        if (v > 0) {
          if (!colSeen.has(v)) colSeen.set(v, []);
          colSeen.get(v)!.push(r * this.size + i);
        }
      });

      rowSeen.forEach(positions => {
        if (positions.length > 1) positions.forEach(p => errors.add(p));
      });

      colSeen.forEach(positions => {
        if (positions.length > 1) positions.forEach(p => errors.add(p));
      });
    }

    // Check cages
    for (const cage of this.puzzle.cages) {
      if (!this.checkCage(cage) && cage.cells.every(i => this.board[i] > 0)) {
        cage.cells.forEach(i => errors.add(i));
      }
    }

    return errors;
  };

  // Solver using backtracking
  solve = (): number[] | null => {
    const board = Array(this.size * this.size).fill(0);
    if (this.solveRecursive(board, 0)) return board;
    return null;
  };

  private solveRecursive = (board: number[], pos: number): boolean => {
    if (pos >= board.length) return true;

    const row = Math.floor(pos / this.size);
    const col = pos % this.size;

    for (let num = 1; num <= this.size; num++) {
      if (this.canPlace(board, pos, num, row, col)) {
        board[pos] = num;
        if (this.solveRecursive(board, pos + 1)) return true;
        board[pos] = 0;
      }
    }
    return false;
  };

  private canPlace = (board: number[], pos: number, num: number, row: number, col: number): boolean => {
    // Check row
    for (let c = 0; c < this.size; c++) {
      if (board[row * this.size + c] === num) return false;
    }
    // Check column
    for (let r = 0; r < this.size; r++) {
      if (board[r * this.size + col] === num) return false;
    }
    // Check cage constraint
    const cage = this.getCageForCell(pos);
    if (cage) {
      const vals = cage.cells.map(i => i === pos ? num : board[i]);
      const filled = vals.filter(v => v > 0);
      if (filled.length === cage.cells.length) {
        if (!this.checkCageValues(cage, vals)) return false;
      }
    }
    return true;
  };

  private checkCageValues = (cage: Cage, vals: number[]): boolean => {
    if (cage.op === '=') return vals[0] === cage.target;
    if (cage.op === '+') return vals.reduce((a, b) => a + b, 0) === cage.target;
    if (cage.op === '×') return vals.reduce((a, b) => a * b, 1) === cage.target;
    if (cage.op === '-') {
      const sorted = [...vals].sort((a, b) => b - a);
      return sorted[0] - sorted.slice(1).reduce((a, b) => a + b, 0) === cage.target;
    }
    if (cage.op === '÷') {
      const sorted = [...vals].sort((a, b) => b - a);
      let result = sorted[0];
      for (let i = 1; i < sorted.length; i++) result /= sorted[i];
      return result === cage.target;
    }
    return false;
  };

  // Set cell directly (for animated solving)
  setCell = (pos: number, value: number): void => {
    this.board[pos] = value;
  };
}
