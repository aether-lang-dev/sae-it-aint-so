// SPDX-License-Identifier: MIT
// From Tsyne's phone-apps/clock-shared.ts (formatStopwatchTime,
// calcSecondMarkerLine, calcStopwatchHandLine) and phone-apps/stopwatch/
// stopwatch.ts (at ae3b8d44), MIT, Copyright (c) 2025 Paul Hammant (see
// ../NOTICE.md). The stopwatch's rules (Lap only while running, Reset clears
// the laps) are Tsyne's, gathered into a class that holds the start instant.

export const STOPWATCH_SIZE = 180;
export const STOPWATCH_CENTER = STOPWATCH_SIZE / 2;
export const STOPWATCH_RADIUS = 80;

export interface Line { x1: number; y1: number; x2: number; y2: number }

/** MM:SS.cc */
export function formatStopwatchTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
}

/** The dial's hand: rotation 0 to 1 is a full turn, 0 at the top. */
export function calcStopwatchHandLine(rotation: number, length: number): Line {
  const angle = rotation * 2 * Math.PI - Math.PI / 2;
  return {
    x1: STOPWATCH_CENTER, y1: STOPWATCH_CENTER,
    x2: STOPWATCH_CENTER + Math.cos(angle) * length,
    y2: STOPWATCH_CENTER + Math.sin(angle) * length,
  };
}

/** One of the 60 second markers; every fifth is longer. */
export function calcSecondMarkerLine(secondIndex: number): Line {
  const angle = (secondIndex / 60) * 2 * Math.PI - Math.PI / 2;
  const innerRadius = secondIndex % 5 === 0 ? STOPWATCH_RADIUS * 0.80 : STOPWATCH_RADIUS * 0.88;
  const outerRadius = STOPWATCH_RADIUS * 0.95;
  return {
    x1: STOPWATCH_CENTER + Math.cos(angle) * innerRadius,
    y1: STOPWATCH_CENTER + Math.sin(angle) * innerRadius,
    x2: STOPWATCH_CENTER + Math.cos(angle) * outerRadius,
    y2: STOPWATCH_CENTER + Math.sin(angle) * outerRadius,
  };
}

export class Stopwatch {
  private base = 0;       // ms counted before the current run
  private startMs = 0;
  running = false;
  laps: number[] = [];

  elapsed(nowMs: number): number { return this.running ? this.base + (nowMs - this.startMs) : this.base; }
  start(nowMs: number): void { if (!this.running) { this.running = true; this.startMs = nowMs; } }
  stop(nowMs: number): void { if (this.running) { this.base = this.elapsed(nowMs); this.running = false; } }
  toggle(nowMs: number): void { if (this.running) this.stop(nowMs); else this.start(nowMs); }
  lap(nowMs: number): void { if (this.running) this.laps.push(this.elapsed(nowMs)); }
  reset(): void { this.running = false; this.base = 0; this.laps = []; }
}
