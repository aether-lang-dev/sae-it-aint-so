// SPDX-License-Identifier: MIT
// The rules and puzzles of Tsyne's ported-apps/tango-puzzle/tango-puzzle.ts (at ae3b8d44), MIT,
// Portions copyright Paul Hammant 2026 (see ../NOTICE.md). Changes: the UI callbacks (onUpdate, onWin)
// are gone, since the page reads the game after each move.

// ============================================================================
// Types & Constants
// ============================================================================

export type CellValue = 'empty' | 'sun' | 'moon';

export interface Puzzle {
  size: number;
  givens: Map<number, CellValue>; // position -> fixed value
}

export const SUN = '☀';
export const MOON = '☽';

// Pre-defined puzzles (size must be even for equal sun/moon count)
export const PUZZLES: Puzzle[] = [
  // 4x4 Easy
  {
    size: 4,
    givens: new Map([[0, 'sun'], [5, 'moon'], [10, 'sun'], [15, 'moon']]),
  },
  // 4x4 Medium
  {
    size: 4,
    givens: new Map([[1, 'sun'], [6, 'moon'], [9, 'sun'], [14, 'moon']]),
  },
  // 6x6 Easy
  {
    size: 6,
    givens: new Map([
      [0, 'sun'], [2, 'moon'], [7, 'sun'], [10, 'moon'],
      [21, 'sun'], [25, 'moon'], [33, 'sun'], [35, 'moon'],
    ]),
  },
  // 6x6 Medium
  {
    size: 6,
    givens: new Map([
      [1, 'moon'], [4, 'sun'], [8, 'sun'], [14, 'moon'],
      [19, 'sun'], [23, 'moon'], [28, 'sun'], [34, 'moon'],
    ]),
  },
  // 6x6 Hard
  {
    size: 6,
    givens: new Map([
      [0, 'sun'], [5, 'moon'], [12, 'moon'], [17, 'sun'],
      [24, 'sun'], [29, 'moon'],
    ]),
  },
];

// ============================================================================
// Game Logic
// ============================================================================

export class TangoPuzzleGame {
  private puzzle: Puzzle;
  private board: CellValue[] = [];
  private size = 4;
  private level = 0;
  private undoStack: CellValue[][] = [];

  constructor() {
    this.puzzle = PUZZLES[0];
    this.size = this.puzzle.size;
    this.reset();
  }

  reset = (): void => {
    const total = this.size * this.size;
    this.board = Array(total).fill('empty');
    for (const [pos, val] of this.puzzle.givens) {
      this.board[pos] = val;
    }
    this.undoStack = [];
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
  getValue = (pos: number): CellValue => this.board[pos];
  isGiven = (pos: number): boolean => this.puzzle.givens.has(pos);
  canUndo = (): boolean => this.undoStack.length > 0;

  tryClick = (pos: number): void => {
    if (this.isGiven(pos)) return;

    this.undoStack.push([...this.board]);
    const current = this.board[pos];
    // Cycle: empty -> sun -> moon -> empty
    this.board[pos] = current === 'empty' ? 'sun' : current === 'sun' ? 'moon' : 'empty';

  };

  undo = (): void => {
    const prev = this.undoStack.pop();
    if (prev) {
      this.board = prev;
    }
  };

  // Check if no more than 2 consecutive same values in a line
  private checkNoTriples = (line: CellValue[]): boolean => {
    for (let i = 0; i <= line.length - 3; i++) {
      if (line[i] !== 'empty' && line[i] === line[i + 1] && line[i] === line[i + 2]) {
        return false;
      }
    }
    return true;
  };

  // Check if line has equal suns and moons (when full)
  private checkBalance = (line: CellValue[]): boolean => {
    const suns = line.filter(v => v === 'sun').length;
    const moons = line.filter(v => v === 'moon').length;
    const half = line.length / 2;
    // If not full, just check we haven't exceeded half
    if (line.includes('empty')) {
      return suns <= half && moons <= half;
    }
    return suns === half && moons === half;
  };

  private getRow = (r: number): CellValue[] => {
    const row: CellValue[] = [];
    for (let c = 0; c < this.size; c++) {
      row.push(this.board[r * this.size + c]);
    }
    return row;
  };

  private getCol = (c: number): CellValue[] => {
    const col: CellValue[] = [];
    for (let r = 0; r < this.size; r++) {
      col.push(this.board[r * this.size + c]);
    }
    return col;
  };

  isValid = (): boolean => {
    for (let i = 0; i < this.size; i++) {
      const row = this.getRow(i);
      const col = this.getCol(i);
      if (!this.checkNoTriples(row) || !this.checkNoTriples(col)) return false;
      if (!this.checkBalance(row) || !this.checkBalance(col)) return false;
    }
    return true;
  };

  isFull = (): boolean => !this.board.includes('empty');

  isWon = (): boolean => this.isFull() && this.isValid();

  getErrors = (): Set<number> => {
    const errors = new Set<number>();

    for (let r = 0; r < this.size; r++) {
      const row = this.getRow(r);
      // Check triples in row
      for (let c = 0; c <= this.size - 3; c++) {
        if (row[c] !== 'empty' && row[c] === row[c + 1] && row[c] === row[c + 2]) {
          errors.add(r * this.size + c);
          errors.add(r * this.size + c + 1);
          errors.add(r * this.size + c + 2);
        }
      }
      // Check balance exceeded
      const suns = row.filter(v => v === 'sun').length;
      const moons = row.filter(v => v === 'moon').length;
      if (suns > this.size / 2 || moons > this.size / 2) {
        for (let c = 0; c < this.size; c++) {
          errors.add(r * this.size + c);
        }
      }
    }

    for (let c = 0; c < this.size; c++) {
      const col = this.getCol(c);
      // Check triples in col
      for (let r = 0; r <= this.size - 3; r++) {
        if (col[r] !== 'empty' && col[r] === col[r + 1] && col[r] === col[r + 2]) {
          errors.add(r * this.size + c);
          errors.add((r + 1) * this.size + c);
          errors.add((r + 2) * this.size + c);
        }
      }
      // Check balance exceeded
      const suns = col.filter(v => v === 'sun').length;
      const moons = col.filter(v => v === 'moon').length;
      if (suns > this.size / 2 || moons > this.size / 2) {
        for (let r = 0; r < this.size; r++) {
          errors.add(r * this.size + c);
        }
      }
    }

    return errors;
  };

}
