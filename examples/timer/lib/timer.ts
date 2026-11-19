// SPDX-License-Identifier: MIT
// From Tsyne's phone-apps/clock-shared.ts (formatTimerTime) and
// phone-apps/timer/timer.ts (at ae3b8d44), MIT, Copyright (c) 2025 Paul
// Hammant (see ../NOTICE.md). The countdown's rules (quick-add is refused
// while it runs, Start needs time on it, it stops at zero) are Tsyne's,
// gathered into a class that holds the time as an end instant, so a slow tick
// loses nothing (Tsyne decremented once per tick).

/** Seconds as HH:MM:SS. */
export function formatTimerTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export class Countdown {
  private left = 0;       // seconds, while stopped
  private endMs = 0;      // the instant it reaches zero, while running
  running = false;

  /** Seconds left, rounded up while running (a display shows 00:00:01 until it is over). */
  seconds(nowMs: number): number {
    return this.running ? Math.max(0, Math.ceil((this.endMs - nowMs) / 1000)) : this.left;
  }
  addMinutes(mins: number): void { if (!this.running) this.left += mins * 60; }
  start(nowMs: number): void {
    if (this.running || this.left <= 0) return;
    this.running = true;
    this.endMs = nowMs + this.left * 1000;
  }
  stop(nowMs: number): void {
    if (!this.running) return;
    this.left = this.seconds(nowMs);
    this.running = false;
  }
  reset(): void { this.running = false; this.left = 0; }
  /** True once, when the time has run out: the countdown stops itself. */
  finished(nowMs: number): boolean {
    if (this.running && nowMs >= this.endMs) { this.running = false; this.left = 0; return true; }
    return false;
  }
}
