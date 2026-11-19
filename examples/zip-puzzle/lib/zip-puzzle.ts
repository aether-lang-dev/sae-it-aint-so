// SPDX-License-Identifier: MIT
// The rules and puzzles of Tsyne's ported-apps/zip-puzzle/zip-puzzle.ts (at ae3b8d44), MIT,
// Portions copyright Paul Hammant 2026 (see ../NOTICE.md). Changes: the UI callbacks (onUpdate, onWin)
// are gone, since the page reads the game after each move.

// ============================================================================
// Types & Constants
// ============================================================================

export interface Puzzle {
  size: number;
  waypoints: Map<number, number>; // position -> waypoint number (1, 2, 3...)
}

export const PUZZLES: Puzzle[] = [
  // 5x5 Easy
  {
    size: 5,
    waypoints: new Map([[0, 1], [4, 2], [24, 3]]),
  },
  // 5x5 Medium
  {
    size: 5,
    waypoints: new Map([[0, 1], [2, 2], [12, 3], [22, 4], [24, 5]]),
  },
  // 6x6 Medium
  {
    size: 6,
    waypoints: new Map([[0, 1], [5, 2], [17, 3], [30, 4], [35, 5]]),
  },
  // 6x6 Hard
  {
    size: 6,
    waypoints: new Map([[0, 1], [3, 2], [14, 3], [21, 4], [32, 5], [35, 6]]),
  },
  // 7x7 Hard
  {
    size: 7,
    waypoints: new Map([[0, 1], [6, 2], [24, 3], [42, 4], [48, 5]]),
  },
];

// ============================================================================
// Game Logic
// ============================================================================

export class ZipPuzzleGame {
  private puzzle: Puzzle;
  private path: number[] = [];
  private size = 5;
  private level = 0;

  constructor() {
    this.puzzle = PUZZLES[0];
    this.size = this.puzzle.size;
    this.reset();
  }

  private getMaxWaypoint = (): number => Math.max(...this.puzzle.waypoints.values());

  reset = (): void => {
    this.path = [];
    // Find starting position (waypoint 1)
    for (const [pos, num] of this.puzzle.waypoints) {
      if (num === 1) {
        this.path = [pos];
        break;
      }
    }
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
  getPath = (): readonly number[] => this.path;
  getWaypoint = (pos: number): number | undefined => this.puzzle.waypoints.get(pos);

  isInPath = (pos: number): boolean => this.path.includes(pos);
  getPathIndex = (pos: number): number => this.path.indexOf(pos);
  isHead = (pos: number): boolean => this.path.length > 0 && this.path[this.path.length - 1] === pos;

  private toXY = (pos: number): [number, number] => [pos % this.size, Math.floor(pos / this.size)];

  private isAdjacent = (a: number, b: number): boolean => {
    const [x1, y1] = this.toXY(a);
    const [x2, y2] = this.toXY(b);
    return (Math.abs(x1 - x2) + Math.abs(y1 - y2)) === 1;
  };

  private getNextRequiredWaypoint = (): number => {
    let maxHit = 0;
    for (const pos of this.path) {
      const wp = this.puzzle.waypoints.get(pos);
      if (wp && wp > maxHit) maxHit = wp;
    }
    return maxHit + 1;
  };

  tryClick = (pos: number): void => {
    if (this.path.length === 0) return;

    const head = this.path[this.path.length - 1];

    // Click on head = undo last move
    if (pos === head && this.path.length > 1) {
      this.path.pop();
      return;
    }

    // Click on previous cell in path = undo back to there
    const idx = this.path.indexOf(pos);
    if (idx >= 0 && idx < this.path.length - 1) {
      this.path = this.path.slice(0, idx + 1);
      return;
    }

    // Try to extend path
    if (!this.isAdjacent(head, pos)) return;
    if (this.path.includes(pos)) return;

    // Check waypoint constraint
    const wp = this.puzzle.waypoints.get(pos);
    const nextRequired = this.getNextRequiredWaypoint();

    // If this cell has a waypoint, it must be the next required one
    if (wp && wp !== nextRequired) return;

    // If we need to hit a waypoint next, we can only go to non-waypoint cells
    // or the correct waypoint
    // (This allows free movement between waypoints)

    this.path.push(pos);

  };

  isWon = (): boolean => {
    const totalCells = this.size * this.size;
    if (this.path.length !== totalCells) return false;

    // Check all waypoints were hit
    const maxWp = this.getMaxWaypoint();
    let lastWpPos = -1;
    for (let wp = 1; wp <= maxWp; wp++) {
      let found = false;
      for (const [pos, num] of this.puzzle.waypoints) {
        if (num === wp) {
          const idx = this.path.indexOf(pos);
          if (idx === -1 || idx <= lastWpPos) return false;
          lastWpPos = idx;
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  };

}
