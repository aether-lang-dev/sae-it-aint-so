// SPDX-License-Identifier: MIT
// The clock's arithmetic, from Tsyne's phone-apps/clock/clock.ts and
// phone-apps/clock-shared.ts (at ae3b8d44), MIT, Copyright (c) 2025 Paul
// Hammant (see ../NOTICE.md). Changes: the geometry helpers are exported as
// they stand (the dial's size and the hand lengths are Tsyne's); the date and
// time are formatted here, since sae's engine has no Intl; setTime's parser is
// new.

export const CLOCK_SIZE = 200;
export const CLOCK_CENTER = CLOCK_SIZE / 2;
export const CLOCK_RADIUS = 90;

export interface Line { x1: number; y1: number; x2: number; y2: number }

/** An hour marker's line: the short stroke just inside the dial's edge. */
export function calcHourMarkerLine(hourIndex: number): Line {
  const angle = (hourIndex / 12) * 2 * Math.PI - Math.PI / 2;
  const innerRadius = CLOCK_RADIUS * 0.85;
  const outerRadius = CLOCK_RADIUS * 0.95;
  return {
    x1: CLOCK_CENTER + Math.cos(angle) * innerRadius,
    y1: CLOCK_CENTER + Math.sin(angle) * innerRadius,
    x2: CLOCK_CENTER + Math.cos(angle) * outerRadius,
    y2: CLOCK_CENTER + Math.sin(angle) * outerRadius,
  };
}

/** A hand from the centre: rotation 0 to 1 is a full turn, 0 at 12 o'clock. */
export function calcHandLine(rotation: number, length: number): Line {
  const angle = rotation * 2 * Math.PI - Math.PI / 2;
  return {
    x1: CLOCK_CENTER,
    y1: CLOCK_CENTER,
    x2: CLOCK_CENTER + Math.cos(angle) * length,
    y2: CLOCK_CENTER + Math.sin(angle) * length,
  };
}

/** The three hands' rotations for a time, as Tsyne's bindings compute them. */
export function handRotations(h: number, m: number, s: number): { hour: number; minute: number; second: number } {
  return { hour: ((h % 12) + m / 60) / 12, minute: (m + s / 60) / 60, second: s / 60 };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const formatTime = (h: number, m: number, s: number): string => `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
export const formatDate = (d: Date): string => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "H:MM" or "HH:MM:SS" to [h, m, s], or null when it is not a time of day. */
export function parseTime(text: string): [number, number, number] | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]), s = m[3] === undefined ? 0 : Number(m[3]);
  if (h > 23 || mi > 59 || s > 59) return null;
  return [h, mi, s];
}
