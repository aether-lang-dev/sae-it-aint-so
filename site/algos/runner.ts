// Drains a generator a few steps at a time, telling a listener about each
// step and, once, about the end. What to draw, count or print is the
// listener's business; when to ask for more is the caller's (a button, the
// frame clock, a test).
export interface Listener<S> {
  step(s: S, n: number): void;
  done(steps: number): void;
}

export class Runner<S> {
  readonly #source: Iterator<S, void, undefined>;
  readonly #listener: Listener<S>;
  #steps = 0;
  #finished = false;

  constructor(source: Iterator<S, void, undefined>, listener: Listener<S>) {
    this.#source = source;
    this.#listener = listener;
  }

  get steps(): number { return this.#steps; }
  get finished(): boolean { return this.#finished; }

  // Take up to `n` steps; returns how many were taken.
  advance(n = 1): number {
    let taken = 0;
    while (taken < n && !this.#finished) {
      const r = this.#source.next();
      if (r.done) {
        this.#finished = true;
        this.#listener.done(this.#steps);
        break;
      }
      taken++;
      this.#listener.step(r.value, ++this.#steps);
    }
    return taken;
  }
}
