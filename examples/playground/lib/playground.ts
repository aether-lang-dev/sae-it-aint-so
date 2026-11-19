// SPDX-License-Identifier: MIT
// The physics of Tsyne's bouncing-ball demo and the shape data of its
// interactive-shapes demo (phone-apps/bouncing-ball/bouncing-ball-cosyne.ts
// and phone-apps/interactive-shapes/interactive-shapes-cosyne.ts, at
// ae3b8d44), MIT, Copyright (c) 2025 Paul Hammant (see ../NOTICE.md). The
// constants (gravity 0.3, damping 0.95, bounce 0.8, walls 10 px in), the three
// balls and the three shapes are Tsyne's; the physics step and the colour
// picker are functions, and the random numbers they use are arguments.

export const WIDTH = 500;
export const HEIGHT = 450;

export interface Ball { x: number; y: number; vx: number; vy: number; radius: number; color: string; dragging: boolean }

export const newBalls = (): Ball[] => [
  { x: 100, y: 50, vx: 5, vy: 0, radius: 15, color: "#FF6B6B", dragging: false },
  { x: 250, y: 50, vx: -3, vy: 0, radius: 20, color: "#4ECDC4", dragging: false },
  { x: 400, y: 50, vx: 2, vy: 0, radius: 12, color: "#45B7D1", dragging: false },
];

const GRAVITY = 0.3, DAMPING = 0.95, BOUNCE = 0.8;

/** One 30 ms tick of one ball: gravity, motion, damping, bounces off the floor, ceiling and walls. */
export function stepBall(ball: Ball): void {
  if (ball.dragging) return;
  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= DAMPING;
  ball.vy *= DAMPING;
  if (ball.y + ball.radius > HEIGHT - 10) { ball.y = HEIGHT - 10 - ball.radius; ball.vy *= -BOUNCE; }
  if (ball.y - ball.radius < 10) { ball.y = 10 + ball.radius; ball.vy *= -BOUNCE; }
  if (ball.x - ball.radius < 10) { ball.x = 10 + ball.radius; ball.vx *= -BOUNCE; }
  if (ball.x + ball.radius > WIDTH - 10) { ball.x = WIDTH - 10 - ball.radius; ball.vx *= -BOUNCE; }
}

/** Let go of a dragged ball: a small flick, as Tsyne's does. */
export function release(ball: Ball, rand: () => number = Math.random): void {
  ball.dragging = false;
  ball.vx = (rand() - 0.5) * 3;
  ball.vy = -5;
}

export const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];

/** A colour other than `exclude`. */
export const pickRandom = (exclude: string, rand: () => number = Math.random): string => COLORS.filter((c) => c !== exclude)[Math.floor(rand() * 4)];

export interface Shape { id: string; type: "circle" | "rect"; x: number; y: number; r?: number; w?: number; h?: number; color: string }
export const newShapes = (): Shape[] => [
  { id: "circle1", type: "circle", x: 100, y: 100, r: 30, color: COLORS[0] },
  { id: "circle2", type: "circle", x: 300, y: 150, r: 25, color: COLORS[1] },
  { id: "rect", type: "rect", x: 150, y: 300, w: 80, h: 60, color: COLORS[2] },
];
